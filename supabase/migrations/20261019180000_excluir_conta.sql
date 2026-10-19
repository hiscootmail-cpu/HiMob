-- =============================================================================
-- Hi Scoot · Excluir minha conta (decisão de 19/10/2026)
-- =============================================================================
-- A pessoa pode excluir a conta (sem reservas em andamento). A conta deixa de
-- funcionar e some da plataforma, mas os dados ficam guardados por segurança
-- e só podem ser fornecidos à Justiça brasileira, mediante ordem judicial.
-- =============================================================================

alter table public.profiles add column deleted_at timestamptz;

-- Perfil de conta excluída não aparece para outras pessoas (a equipe ainda vê).
drop policy "Perfis públicos: qualquer pessoa vê" on public.profiles;
create policy "Perfis públicos: qualquer pessoa vê (menos contas excluídas)"
  on public.profiles for select
  using (deleted_at is null or id = auth.uid() or public.is_admin());
revoke update (deleted_at) on public.profiles from authenticated;

-- Busca: anúncios de quem excluiu a conta saem da plataforma.
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
  where e.review_status = 'approved' and p.deleted_at is null and (p_id is null or e.id = p_id)
  order by e.created_at desc
$$;

-- Não começa conversa com quem excluiu a conta.
create or replace function public.start_conversation(p_equipment uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  e public.equipment;
  me public.profiles;
  conv uuid;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null or me.identity_status = 'blocked' or me.deleted_at is not null then
    raise exception 'not_allowed';
  end if;
  select * into e from public.equipment where id = p_equipment;
  if e.id is null or e.review_status <> 'approved'
     or exists (select 1 from public.profiles h where h.id = e.host_id and h.deleted_at is not null) then
    raise exception 'not_allowed';
  end if;
  if e.host_id = me.id then
    raise exception 'own_listing';
  end if;
  insert into public.conversations (equipment_id, rider_id, host_id)
    values (e.id, me.id, e.host_id)
    on conflict (equipment_id, rider_id) do nothing;
  select id into conv from public.conversations where equipment_id = e.id and rider_id = me.id;
  return conv;
end;
$$;

-- "Excluir minha conta"
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null or not exists (select 1 from public.profiles where id = me and deleted_at is null) then
    raise exception 'not_allowed';
  end if;
  if exists (
    select 1 from public.bookings b
     where me in (b.rider_id, b.host_id) and b.status in ('pending', 'accepted', 'confirmed', 'active')
  ) then
    raise exception 'ongoing_bookings';
  end if;

  update public.profiles set deleted_at = now() where id = me;
  -- Anúncios saem do ar; a lista de espera e a conexão com o Mercado Pago são desfeitas.
  update public.equipment set is_available = false where host_id = me;
  delete from public.waitlist where user_id = me;
  delete from public.mp_accounts where user_id = me;
end;
$$;

-- A conta foi excluída? (o site encerra a sessão de quem excluiu)
create or replace function public.account_deleted()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and deleted_at is not null)
$$;

revoke execute on function public.delete_my_account() from public, anon;
revoke execute on function public.account_deleted() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.account_deleted() to authenticated;
