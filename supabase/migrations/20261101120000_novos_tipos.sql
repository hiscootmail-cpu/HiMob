-- =============================================================================
-- Novos tipos de equipamento: Skate elétrico e Jetboard (decisão de 22/10/2026)
-- -----------------------------------------------------------------------------
-- - O Host anuncia também skate elétrico ('eskate') e jetboard ('jetboard').
-- - Jetboard (usado na água): só para maiores de 21 anos. A pessoa informa a
--   data de nascimento na hora de reservar (a equipe confere no documento) e o
--   banco não deixa reservar sem ela ou com menos de 21. O site mostra um aviso
--   de segurança no anúncio e na reserva.
-- - Em "Minhas viagens", a pessoa marca um ou mais tipos que pretende usar.
-- =============================================================================

do $$
declare c record;
begin
  for c in select conname from pg_constraint
            where conrelid = 'public.equipment'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) like '%scooter%'
  loop
    execute format('alter table public.equipment drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.equipment
  add constraint equipment_type_check check (type in ('scooter', 'ebike', 'eskate', 'jetboard'));

-- Data de nascimento (parte privada do perfil). A pessoa informa uma vez; depois
-- do documento aprovado, só a equipe muda.
alter table public.profile_private
  add column birth_date date check (birth_date is null or birth_date between date '1900-01-01' and date '2100-01-01');

create or replace function public.set_birth_date(p_date date)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles;
  current_date_value date;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception 'not_allowed'; end if;
  if p_date is null or p_date > public.today_sp() or p_date < public.today_sp() - interval '120 years' then
    raise exception 'birth_date_invalid';
  end if;
  select birth_date into current_date_value from public.profile_private where id = me.id;
  if current_date_value is not null and me.identity_status = 'approved' and current_date_value <> p_date then
    raise exception 'birth_date_locked';
  end if;
  update public.profile_private set birth_date = p_date where id = me.id;
end;
$$;
revoke execute on function public.set_birth_date(date) from public, anon;
grant execute on function public.set_birth_date(date) to authenticated;

/** Jetboard: só para maiores de 21 anos (vale para qualquer forma de criar a reserva). */
create or replace function public.bookings_jetboard_age()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  born date;
begin
  if (select type from public.equipment where id = new.equipment_id) = 'jetboard' then
    select birth_date into born from public.profile_private where id = new.rider_id;
    if born is null then raise exception 'birth_date_required'; end if;
    if born > (new.start_date - interval '21 years')::date then raise exception 'too_young'; end if;
  end if;
  return new;
end;
$$;
create trigger bookings_jetboard_age before insert on public.bookings
  for each row execute function public.bookings_jetboard_age();
revoke execute on function public.bookings_jetboard_age() from public, anon, authenticated;

-- Viagens: um ou mais tipos ("os dois" vira patinete e bike).
alter table public.rider_trips drop constraint if exists rider_trips_wants_check;
alter table public.rider_trips
  alter column wants type text[] using (case wants when 'both' then array['scooter', 'ebike'] else array[wants] end);
alter table public.rider_trips
  add constraint rider_trips_wants_check
    check (cardinality(wants) between 1 and 4 and wants <@ array['scooter', 'ebike', 'eskate', 'jetboard']);

-- Painel → Operação com os quatro tipos.
create or replace function public.admin_operations(p_city text default null, p_state text default null, p_country text default null)
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
      from (values ('scooter'), ('ebike'), ('eskate'), ('jetboard')) as t(type)
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

drop function public.admin_trip_demand(text, text, text);
create function public.admin_trip_demand(p_city text default null, p_state text default null, p_country text default null)
returns table (city text, city_state text, next7 bigint, next30 bigint, next90 bigint,
               wants_scooter bigint, wants_ebike bigint, wants_eskate bigint, wants_jetboard bigint, equipment bigint)
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
         count(*) filter (where 'scooter' = any (t.wants)),
         count(*) filter (where 'ebike' = any (t.wants)),
         count(*) filter (where 'eskate' = any (t.wants)),
         count(*) filter (where 'jetboard' = any (t.wants)),
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
