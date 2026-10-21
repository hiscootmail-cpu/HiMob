-- =============================================================================
-- Painel → Operação: filtro por cidade, estado ou país (decisão de 21/10/2026)
-- -----------------------------------------------------------------------------
-- A Hi Scoot pode crescer para todo o Brasil e outros países. Cada cidade com
-- anúncio ganha estado e país, preenchidos sozinhos pelo site a partir do ponto
-- do anúncio no mapa (OpenStreetMap). O Host não digita nada a mais.
-- Riders: o cadastro guarda só a cidade; no filtro por estado ou país contam os
-- Riders das cidades daquela região que já têm anúncio.
-- =============================================================================

/** Mesma chave para "Mogi Mirim", " mogi mirim" e "Mogí Mirim" (igual a same_city). */
create or replace function public.city_key(p_city text)
returns text language sql immutable set search_path = '' as $$
  select translate(lower(btrim(coalesce(p_city, ''))), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')
$$;

create table public.city_regions (
  city_key text primary key,
  city text not null check (char_length(btrim(city)) between 1 and 60),
  state text check (state is null or char_length(state) between 1 and 80),
  -- Sigla do estado quando existir (ex.: SP).
  state_code text check (state_code is null or state_code ~ '^[A-Z0-9]{1,4}$'),
  -- País em duas letras (ex.: BR, PT).
  country text not null check (country ~ '^[A-Z]{2}$'),
  created_at timestamptz not null default now()
);

alter table public.city_regions enable row level security;
create policy "Regiões: só a equipe vê" on public.city_regions for select to authenticated using (public.is_admin());
create policy "Regiões: só a equipe grava" on public.city_regions for insert to authenticated with check (public.is_admin());
create policy "Regiões: só a equipe muda" on public.city_regions for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.city_regions from anon;

drop function public.admin_operations(text);

/**
 * Números da operação (só a equipe). Filtros opcionais e combináveis:
 * p_city (cidade), p_state (nome do estado) e p_country (duas letras).
 */
create function public.admin_operations(p_city text default null, p_state text default null, p_country text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_city text := nullif(btrim(coalesce(p_city, '')), '');
  v_state text := nullif(btrim(coalesce(p_state, '')), '');
  v_country text := upper(nullif(btrim(coalesce(p_country, '')), ''));
  result jsonb;
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;

  with region as (
    -- Cidades do estado/país escolhido (sem filtro de região: null = todas).
    select r.city_key from public.city_regions r
    where (v_state is not null or v_country is not null)
      and (v_state is null or lower(r.state) = lower(v_state))
      and (v_country is null or r.country = v_country)
  ), eq as (
    select e.* from public.equipment e
    where e.review_status = 'approved' and e.is_available
      and (v_city is null or public.same_city(e.city, v_city))
      and ((v_state is null and v_country is null) or public.city_key(e.city) in (select city_key from region))
  ), people as (
    select p.* from public.profiles p
    where p.deleted_at is null
      and (v_city is null or public.same_city(p.city, v_city))
      and ((v_state is null and v_country is null) or public.city_key(p.city) in (select city_key from region))
  ), in_use as (
    select e.type, count(distinct b.equipment_id) as n from public.bookings b
      join public.equipment e on e.id = b.equipment_id
     where b.status = 'active'
       and (v_city is null or public.same_city(e.city, v_city))
       and ((v_state is null and v_country is null) or public.city_key(e.city) in (select city_key from region))
     group by e.type
  )
  select jsonb_build_object(
    'riders', (select count(*) from people),
    'riders_verified', (select count(*) from people where identity_status = 'approved'),
    'hosts', (select count(distinct eq.host_id) from eq join public.profiles p on p.id = eq.host_id and p.deleted_at is null),
    'equipment', (
      select jsonb_object_agg(t.type, jsonb_build_object(
        'published', (select count(*) from eq where eq.type = t.type),
        'with_days', (select count(*) from eq where eq.type = t.type
                        and exists (select 1 from public.equipment_available_days d
                                    where d.equipment_id = eq.id and d.day >= public.today_sp())),
        'in_use', coalesce((select n from in_use where in_use.type = t.type), 0)
      ))
      from (values ('scooter'), ('ebike')) as t(type)
    ),
    'pickups_today', (
      select count(*) from public.bookings b join public.equipment e on e.id = b.equipment_id
       where b.status in ('confirmed', 'active') and b.start_date = public.today_sp()
         and (v_city is null or public.same_city(e.city, v_city))
         and ((v_state is null and v_country is null) or public.city_key(e.city) in (select city_key from region))
    ),
    'queue_listings', (select count(*) from public.equipment where review_status = 'pending'),
    'queue_edits', (select count(*) from public.equipment_edits where status = 'pending'),
    'queue_identity', (select count(*) from public.identity_submissions where status = 'pending')
  ) into result;
  return result;
end;
$$;

/**
 * Cidades com anúncio aprovado, com estado e país quando já conhecidos, e um
 * ponto do mapa para o site descobrir a região das que ainda não têm.
 */
create or replace function public.admin_places()
returns table (city text, state text, state_code text, country text, latitude double precision, longitude double precision)
language sql stable security definer set search_path = '' as $$
  select distinct on (public.city_key(e.city))
         coalesce(r.city, btrim(e.city)), r.state, r.state_code, r.country, e.latitude, e.longitude
  from public.equipment e
  left join public.city_regions r on r.city_key = public.city_key(e.city)
  where public.is_admin() and e.review_status = 'approved'
  order by public.city_key(e.city), e.latitude is null
$$;

revoke execute on function public.admin_operations(text, text, text) from public, anon;
revoke execute on function public.admin_places() from public, anon;
grant execute on function public.admin_operations(text, text, text) to authenticated;
grant execute on function public.admin_places() to authenticated;
