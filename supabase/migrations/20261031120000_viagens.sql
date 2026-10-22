-- =============================================================================
-- Viagens do Rider (decisão de 22/10/2026)
-- -----------------------------------------------------------------------------
-- A pessoa marca várias viagens (ex.: uma esta semana, outra no mês que vem):
-- cidade (lista oficial), ida, volta e o que pretende usar (patinete, bike ou os
-- dois). As viagens não se cruzam. Da ida até a volta, o Explorar abre na cidade
-- da viagem. A equipe vê a demanda futura por cidade no Painel → Operação.
-- Substitui a viagem única guardada no perfil (travel_*), que é copiada para cá.
-- =============================================================================

create table public.rider_trips (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.profiles (id) on delete cascade,
  city text not null check (char_length(btrim(city)) between 1 and 60),
  city_state text not null check (city_state ~ '^[A-Z]{2}$'),
  from_day date not null,
  until_day date not null,
  wants text not null check (wants in ('scooter', 'ebike', 'both')),
  created_at timestamptz not null default now(),
  check (from_day <= until_day and until_day - from_day <= 365),
  -- Uma viagem de cada vez: as datas da mesma pessoa não se cruzam.
  constraint rider_trips_no_overlap exclude using gist (
    rider_id with =,
    daterange(from_day, until_day, '[]') with &&
  )
);
create index rider_trips_days_idx on public.rider_trips (until_day, from_day);

alter table public.rider_trips enable row level security;
create policy "Viagens: a pessoa vê as suas; a equipe vê todas" on public.rider_trips
  for select to authenticated using (rider_id = auth.uid() or public.is_admin());
create policy "Viagens: a pessoa marca as suas, de hoje em diante" on public.rider_trips
  for insert to authenticated with check (rider_id = auth.uid() and until_day >= public.today_sp() and from_day <= public.today_sp() + 365);
create policy "Viagens: a pessoa muda as suas" on public.rider_trips
  for update to authenticated using (rider_id = auth.uid())
  with check (rider_id = auth.uid() and until_day >= public.today_sp() and from_day <= public.today_sp() + 365);
create policy "Viagens: a pessoa apaga as suas" on public.rider_trips
  for delete to authenticated using (rider_id = auth.uid());
revoke all on public.rider_trips from anon;
revoke update (rider_id, created_at, id) on public.rider_trips from authenticated;

/** Até 10 viagens por vir por pessoa; a cidade entra nas regiões do Painel → Operação. */
create or replace function public.rider_trips_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and (select count(*) from public.rider_trips
                            where rider_id = new.rider_id and until_day >= public.today_sp()) >= 10 then
    raise exception 'too_many_trips';
  end if;
  if public.br_state_name(new.city_state) is null then raise exception 'invalid_state'; end if;
  insert into public.city_regions (city_key, city, state, state_code, country)
    values (public.city_key(new.city), btrim(new.city), public.br_state_name(new.city_state), new.city_state, 'BR')
    on conflict (city_key) do nothing;
  return new;
end;
$$;
create trigger rider_trips_guard before insert or update on public.rider_trips
  for each row execute function public.rider_trips_guard();

-- A viagem única do perfil vira a primeira viagem da lista.
insert into public.rider_trips (rider_id, city, city_state, from_day, until_day, wants)
  select id, travel_city, travel_city_state, coalesce(travel_from, public.today_sp()), travel_until, 'both'
  from public.profiles
  where travel_city is not null and travel_until >= public.today_sp() and deleted_at is null;
update public.profiles set travel_city = null, travel_city_state = null, travel_from = null, travel_until = null
  where travel_city is not null;
revoke update (travel_city, travel_city_state, travel_from, travel_until) on public.profiles from authenticated;

/**
 * Painel → Operação: viagens marcadas por cidade (só a equipe). Para cada
 * cidade: quantas viagens acontecem nos próximos 7, 30 e 90 dias (ou já estão
 * acontecendo), o que pretendem usar e quantos equipamentos publicados há lá.
 * Mesmo filtro de cidade, estado e país do restante da página.
 */
create or replace function public.admin_trip_demand(p_city text default null, p_state text default null, p_country text default null)
returns table (city text, city_state text, next7 bigint, next30 bigint, next90 bigint,
               wants_scooter bigint, wants_ebike bigint, wants_both bigint, equipment bigint)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_city text := nullif(btrim(coalesce(p_city, '')), '');
  v_state text := nullif(btrim(coalesce(p_state, '')), '');
  v_country text := upper(nullif(btrim(coalesce(p_country, '')), ''));
  today date := public.today_sp();
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  return query
  with trips as (
    select t.* from public.rider_trips t
    join public.profiles p on p.id = t.rider_id and p.deleted_at is null
    where t.until_day >= today and t.from_day <= today + 90
      and (v_city is null or public.same_city(t.city, v_city))
      and (v_state is null or exists (select 1 from public.city_regions r
             where r.city_key = public.city_key(t.city) and lower(r.state) = lower(v_state)))
      and (v_country is null or exists (select 1 from public.city_regions r
             where r.city_key = public.city_key(t.city) and r.country = v_country))
  )
  select min(btrim(t.city)), min(t.city_state),
         count(*) filter (where t.from_day <= today + 7),
         count(*) filter (where t.from_day <= today + 30),
         count(*),
         count(*) filter (where t.wants = 'scooter'),
         count(*) filter (where t.wants = 'ebike'),
         count(*) filter (where t.wants = 'both'),
         (select count(*) from public.equipment e
           where e.review_status = 'approved' and e.is_available and public.city_key(e.city) = public.city_key(min(t.city)))
  from trips t
  group by public.city_key(t.city)
  order by count(*) filter (where t.from_day <= today + 30) desc, count(*) desc, min(t.city)
  limit 50;
end;
$$;

revoke execute on function public.admin_trip_demand(text, text, text) from public, anon;
grant execute on function public.admin_trip_demand(text, text, text) to authenticated;
revoke execute on function public.rider_trips_guard() from public, anon, authenticated;
