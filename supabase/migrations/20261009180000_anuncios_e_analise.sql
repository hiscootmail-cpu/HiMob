-- =============================================================================
-- Hi Scoot · Etapa 3 do banco: anúncios de verdade e análise da equipe
-- =============================================================================
-- Funções que o site chama. Cada uma confere quem está pedindo e as regras
-- aprovadas antes de gravar; as tabelas continuam protegidas pelas regras
-- de segurança da etapa 1.
-- =============================================================================

-- O Host pode apagar um anúncio próprio que ainda não foi publicado (usado se
-- o envio das fotos falhar no meio do cadastro).
create policy "Anúncios: o Host apaga o próprio em análise"
  on public.equipment for delete to authenticated
  using (host_id = auth.uid() and review_status = 'pending');
grant delete on public.equipment to authenticated;

-- -----------------------------------------------------------------------------
-- Busca pública: só anúncios aprovados, com fotos, notas e o Host (nome curto)
-- -----------------------------------------------------------------------------
create or replace function public.listings(p_id uuid default null)
returns table (
  id uuid, host_id uuid, type text, title text, description text, daily_price numeric,
  city text, area text, latitude double precision, longitude double precision,
  pickup_time time, return_time time, is_available boolean, photos text[],
  rating_avg numeric, rating_count integer,
  host_name text, host_verified boolean, host_since smallint,
  host_rating_avg numeric, host_rating_count integer
)
language sql stable security definer set search_path = '' as $$
  select
    e.id, e.host_id, e.type, e.title, e.description, e.daily_price,
    e.city, e.area, e.latitude, e.longitude,
    e.pickup_time, e.return_time, e.is_available,
    coalesce((select array_agg(ph.path order by ph.position) from public.equipment_photos ph where ph.equipment_id = e.id), '{}'),
    er.avg, coalesce(er.n, 0),
    p.display_name, p.identity_status = 'approved', p.host_since,
    hr.avg, coalesce(hr.n, 0)
  from public.equipment e
  join public.profiles p on p.id = e.host_id
  left join lateral (
    select round(avg(r.equipment_rating), 1) as avg, count(r.equipment_rating)::int as n
      from public.reviews r join public.bookings b on b.id = r.booking_id
     where b.equipment_id = e.id and r.equipment_rating is not null
  ) er on true
  left join lateral (
    select round(avg(r.rating), 1) as avg, count(*)::int as n
      from public.reviews r where r.target_id = e.host_id and r.target_role = 'host'
  ) hr on true
  where e.review_status = 'approved' and (p_id is null or e.id = p_id)
  order by e.created_at desc
$$;

-- -----------------------------------------------------------------------------
-- Aplicar mudanças num anúncio (uso interno: reenvio de recusado e edição aprovada)
-- -----------------------------------------------------------------------------
create or replace function public.apply_listing_changes(p_id uuid, c jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.equipment set
    type = coalesce(c ->> 'type', type),
    title = coalesce(c ->> 'title', title),
    description = coalesce(c ->> 'description', description),
    daily_price = coalesce((c ->> 'daily_price')::numeric, daily_price),
    city = coalesce(c ->> 'city', city),
    area = coalesce(c ->> 'area', area),
    pickup_time = coalesce((c ->> 'pickup_time')::time, pickup_time),
    return_time = coalesce((c ->> 'return_time')::time, return_time)
  where id = p_id;

  update public.equipment_private set
    pickup_address = coalesce(c ->> 'pickup_address', pickup_address),
    latitude = coalesce((c ->> 'latitude')::double precision, latitude),
    longitude = coalesce((c ->> 'longitude')::double precision, longitude)
  where equipment_id = p_id;

  if jsonb_typeof(c -> 'photos') = 'array' and jsonb_array_length(c -> 'photos') > 0 then
    delete from public.equipment_photos where equipment_id = p_id;
    insert into public.equipment_photos (equipment_id, path, position)
      select p_id, value, (ordinality - 1)::smallint
        from jsonb_array_elements_text(c -> 'photos') with ordinality;
  end if;
end;
$$;
revoke execute on function public.apply_listing_changes(uuid, jsonb) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Host: enviar edição (uma vez a cada 30 dias desde o último envio)
-- -----------------------------------------------------------------------------
-- Publicado: a edição vai para a análise e o anúncio antigo segue no ar.
-- Recusado: as correções entram no anúncio, que volta para a análise.
create or replace function public.submit_listing_edit(p_id uuid, p_changes jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  e public.equipment;
  allowed text[] := array['type', 'title', 'description', 'daily_price', 'city', 'area',
                          'pickup_time', 'return_time', 'pickup_address', 'latitude', 'longitude', 'photos'];
  photo text;
begin
  select * into e from public.equipment where id = p_id and host_id = auth.uid() for update;
  if not found then raise exception 'not_allowed'; end if;
  if e.review_status = 'pending' then raise exception 'in_review'; end if;
  if exists (select 1 from public.equipment_edits where equipment_id = p_id and status = 'pending') then
    raise exception 'edit_in_review';
  end if;
  if e.last_sent_at > now() - interval '30 days' then raise exception 'too_soon'; end if;
  if exists (select 1 from jsonb_object_keys(p_changes) k where k <> all (allowed)) then
    raise exception 'invalid_field';
  end if;
  -- Fotos novas: de 4 a 10, todas na pasta do próprio Host.
  if p_changes ? 'photos' then
    if jsonb_array_length(p_changes -> 'photos') not between 4 and 10 then raise exception 'photos_count'; end if;
    for photo in select jsonb_array_elements_text(p_changes -> 'photos') loop
      if split_part(photo, '/', 1) <> auth.uid()::text then raise exception 'not_allowed'; end if;
    end loop;
  end if;

  if e.review_status = 'rejected' then
    perform public.apply_listing_changes(p_id, p_changes);
    update public.equipment set review_status = 'pending', review_reason = null, last_sent_at = now() where id = p_id;
    return 'resent';
  end if;

  insert into public.equipment_edits (equipment_id, host_id, changes) values (p_id, auth.uid(), p_changes);
  update public.equipment set last_sent_at = now() where id = p_id;
  return 'edit';
end;
$$;

-- -----------------------------------------------------------------------------
-- Equipe: decisões (Motivo obrigatório para recusar, decisão de 09/10/2026)
-- -----------------------------------------------------------------------------
create or replace function public.require_reason(p_approve boolean, p_reason text)
returns text language plpgsql immutable as $$
begin
  if p_approve then return null; end if;
  if p_reason is null or char_length(trim(p_reason)) < 10 then raise exception 'reason_required'; end if;
  if char_length(trim(p_reason)) > 500 then raise exception 'reason_too_long'; end if;
  return trim(p_reason);
end;
$$;

create or replace function public.review_listing(p_id uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_reason text := public.require_reason(p_approve, p_reason);
  e public.equipment;
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  update public.equipment
     set review_status = case when p_approve then 'approved' else 'rejected' end,
         review_reason = v_reason
   where id = p_id and review_status = 'pending'
  returning * into e;
  if not found then raise exception 'not_found'; end if;
  insert into public.notifications (user_id, kind, href, title)
    values (e.host_id, case when p_approve then 'listingApproved' else 'listingRejected' end, '/host/equipment', e.title);
end;
$$;

create or replace function public.review_listing_edit(p_edit uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_reason text := public.require_reason(p_approve, p_reason);
  ed public.equipment_edits;
  eq_title text;
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  update public.equipment_edits
     set status = case when p_approve then 'approved' else 'rejected' end,
         reason = v_reason, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_edit and status = 'pending'
  returning * into ed;
  if not found then raise exception 'not_found'; end if;
  if p_approve then perform public.apply_listing_changes(ed.equipment_id, ed.changes); end if;
  select title into eq_title from public.equipment where id = ed.equipment_id;
  insert into public.notifications (user_id, kind, href, title)
    values (ed.host_id, case when p_approve then 'listingApproved' else 'listingRejected' end, '/host/equipment', eq_title);
end;
$$;

-- Documento: 2 recusas bloqueiam alugar e anunciar. Carta (nome social) recusada
-- não conta como recusa de documento; carta aprovada aprova a identidade.
create or replace function public.review_identity(p_submission uuid, p_approve boolean, p_reason text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_reason text := public.require_reason(p_approve, p_reason);
  s public.identity_submissions;
  new_status text;
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  update public.identity_submissions
     set status = case when p_approve then 'approved' else 'rejected' end,
         reason = v_reason, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_submission and status = 'pending'
  returning * into s;
  if not found then raise exception 'not_found'; end if;

  if p_approve then
    new_status := 'approved';
    update public.profile_private set identity_reason = null where id = s.user_id;
  elsif s.kind = 'document' then
    update public.profile_private
       set identity_rejections = identity_rejections + 1, identity_reason = v_reason
     where id = s.user_id;
    select case when identity_rejections >= 2 then 'blocked' else 'rejected' end
      into new_status from public.profile_private where id = s.user_id;
  else
    update public.profile_private set identity_reason = v_reason where id = s.user_id;
    select identity_status into new_status from public.profiles where id = s.user_id;
  end if;

  update public.profiles set identity_status = new_status where id = s.user_id;
  insert into public.notifications (user_id, kind, href)
    values (s.user_id, case when p_approve then 'documentApproved' else 'documentRejected' end, '/verify-identity');
  return new_status;
end;
$$;

-- Funções só para quem está conectado (a busca pública fica aberta a todos).
revoke execute on function public.submit_listing_edit(uuid, jsonb) from public, anon;
revoke execute on function public.review_listing(uuid, boolean, text) from public, anon;
revoke execute on function public.review_listing_edit(uuid, boolean, text) from public, anon;
revoke execute on function public.review_identity(uuid, boolean, text) from public, anon;
grant execute on function public.submit_listing_edit(uuid, jsonb) to authenticated;
grant execute on function public.review_listing(uuid, boolean, text) to authenticated;
grant execute on function public.review_listing_edit(uuid, boolean, text) to authenticated;
grant execute on function public.review_identity(uuid, boolean, text) to authenticated;

-- Fotos públicas dos anúncios: qualquer pessoa pode ver (pasta pública).
create policy "Fotos de anúncio: qualquer pessoa vê"
  on storage.objects for select
  using (bucket_id = 'equipment-photos');
