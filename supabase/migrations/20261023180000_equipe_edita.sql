-- =============================================================================
-- Hi Scoot · A equipe sempre consegue editar os equipamentos da Hi Scoot
-- =============================================================================
-- - Edição antiga ainda "em análise" (feita antes de a equipe editar na hora)
--   não trava mais: a nova edição da equipe substitui a antiga.
-- - Anúncio da equipe ainda em análise também pode ser editado; o site aprova
--   em seguida.
-- Hosts comuns continuam com as regras de sempre.
-- =============================================================================

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
  if e.review_status = 'pending' and not public.is_admin() then raise exception 'in_review'; end if;
  if public.is_admin() then
    -- A nova edição da equipe substitui a que estava esperando análise.
    update public.equipment_edits
       set status = 'rejected', reason = 'Substituída por uma nova edição da equipe.', reviewed_by = auth.uid(), reviewed_at = now()
     where equipment_id = p_id and status = 'pending';
  elsif exists (select 1 from public.equipment_edits where equipment_id = p_id and status = 'pending') then
    raise exception 'edit_in_review';
  end if;
  -- A equipe edita os equipamentos da Hi Scoot quando quiser.
  if e.last_sent_at > now() - interval '30 days' and not public.is_admin() then raise exception 'too_soon'; end if;
  if exists (select 1 from jsonb_object_keys(p_changes) k where k <> all (allowed)) then
    raise exception 'invalid_field';
  end if;
  -- Fotos novas: de 2 a 10, todas na pasta do próprio Host.
  if p_changes ? 'photos' then
    if jsonb_array_length(p_changes -> 'photos') not between 2 and 10 then raise exception 'photos_count'; end if;
    for photo in select jsonb_array_elements_text(p_changes -> 'photos') loop
      if split_part(photo, '/', 1) <> auth.uid()::text then raise exception 'not_allowed'; end if;
    end loop;
  end if;

  if e.review_status in ('rejected', 'pending') then
    perform public.apply_listing_changes(p_id, p_changes);
    update public.equipment set review_status = 'pending', review_reason = null, last_sent_at = now() where id = p_id;
    return 'resent';
  end if;

  insert into public.equipment_edits (equipment_id, host_id, changes) values (p_id, auth.uid(), p_changes);
  update public.equipment set last_sent_at = now() where id = p_id;
  return 'edit';
end;
$$;
