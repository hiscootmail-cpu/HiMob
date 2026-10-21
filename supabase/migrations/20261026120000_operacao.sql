-- =============================================================================
-- Painel → Operação (decisão de 21/10/2026)
-- -----------------------------------------------------------------------------
-- Números da operação para a equipe, com filtro opcional por cidade:
-- - Riders: cadastrados e com documento aprovado (podem alugar).
-- - Hosts: pessoas com pelo menos 1 anúncio publicado.
-- - Equipamentos por tipo: publicados, com dias liberados de hoje em diante e
--   em uso agora (retirados e ainda não devolvidos).
-- - Reservas com retirada hoje e as filas do painel.
-- Só a equipe chama. Contas excluídas não contam.
-- =============================================================================

create or replace function public.admin_operations(p_city text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_city text := nullif(btrim(coalesce(p_city, '')), '');
  result jsonb;
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;

  with eq as (
    select e.* from public.equipment e
    where e.review_status = 'approved' and e.is_available
      and (v_city is null or public.same_city(e.city, v_city))
  ), people as (
    select p.* from public.profiles p
    where p.deleted_at is null and (v_city is null or public.same_city(p.city, v_city))
  )
  select jsonb_build_object(
    'riders', (select count(*) from people),
    'riders_verified', (select count(*) from people where identity_status = 'approved'),
    'hosts', (select count(distinct eq.host_id) from eq join public.profiles p on p.id = eq.host_id and p.deleted_at is null),
    'equipment', (
      select coalesce(jsonb_object_agg(t.type, jsonb_build_object(
        'published', (select count(*) from eq where eq.type = t.type),
        'with_days', (select count(*) from eq where eq.type = t.type
                        and exists (select 1 from public.equipment_available_days d
                                    where d.equipment_id = eq.id and d.day >= public.today_sp())),
        'in_use', (select count(distinct b.equipment_id) from public.bookings b
                     join public.equipment e on e.id = b.equipment_id
                    where b.status = 'active' and e.type = t.type
                      and (v_city is null or public.same_city(e.city, v_city)))
      )), '{}'::jsonb)
      from (values ('scooter'), ('ebike')) as t(type)
    ),
    'pickups_today', (
      select count(*) from public.bookings b join public.equipment e on e.id = b.equipment_id
       where b.status in ('confirmed', 'active') and b.start_date = public.today_sp()
         and (v_city is null or public.same_city(e.city, v_city))
    ),
    'queue_listings', (select count(*) from public.equipment where review_status = 'pending'),
    'queue_edits', (select count(*) from public.equipment_edits where status = 'pending'),
    'queue_identity', (select count(*) from public.identity_submissions where status = 'pending'),
    'cities', (
      select coalesce(jsonb_agg(c order by c), '[]'::jsonb)
      from (select distinct on (lower(btrim(city))) btrim(city) as c from public.equipment
             where review_status = 'approved' order by lower(btrim(city)), city) x
    )
  ) into result;
  return result;
end;
$$;

revoke execute on function public.admin_operations(text) from public, anon;
grant execute on function public.admin_operations(text) to authenticated;
