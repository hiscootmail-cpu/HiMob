-- =============================================================================
-- Preço por hora e taxa 15% + 15% (decisões de 26/10 e 16/11/2026)
-- -----------------------------------------------------------------------------
-- Preço:
-- - O Host define o PREÇO POR HORA (o que ele recebe por hora). A diária
--   continua existindo como teto: se as horas passarem dela, vale a diária.
-- - Valor do Host por um aluguel: até 24 h, horas x preço por hora, sem passar
--   de 1 diária; cada 24 h a mais conta 1 diária e o que sobra vai por hora,
--   sem passar de 1 diária.
-- - Anúncios antigos: preço por hora = diária / horas de atendimento (o
--   mesmo valor que já era cobrado).
-- Taxa:
-- - Reservas novas: 15% do Host (já no preço do anúncio) + 15% do Rider sobre
--   o preço do anúncio. Ex.: Host R$ 30,00 -> anúncio R$ 34,50 -> Rider paga
--   R$ 39,68; Host recebe R$ 30,00 e a Hi Scoot R$ 9,68.
-- - Reservas que já existiam continuam com a regra antiga (só os 15%).
--   bookings.fee_model guarda qual regra vale ('single' ou 'double'). O valor
--   da taxa é calculado pelo site a partir do valor do Host (host_amount).
-- =============================================================================

alter table public.equipment add column hourly_price numeric(7, 2) check (hourly_price is null or (hourly_price > 0 and hourly_price <= 999));
update public.equipment set hourly_price = round(daily_price /
  case when return_time > pickup_time then extract(epoch from (return_time - pickup_time)) / 3600.0 else 24 end, 2);
-- Mínimo de R$ 0,01 por hora para anúncios muito baratos.
update public.equipment set hourly_price = 0.01 where hourly_price is not null and hourly_price <= 0;

-- Diária (teto) pode ir até R$ 9.999 (ex.: jetboard em região turística).
do $$
declare c record;
begin
  for c in select conname from pg_constraint
            where conrelid = 'public.equipment'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) like '%daily_price%'
  loop
    execute format('alter table public.equipment drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.equipment alter column daily_price type numeric(7, 2);
alter table public.equipment add constraint equipment_daily_price_check check (daily_price > 0 and daily_price <= 9999);
alter table public.bookings alter column host_daily_price type numeric(7, 2);

alter table public.bookings
  add column host_hourly_price numeric(7, 2),
  add column fee_model text not null default 'single' check (fee_model in ('single', 'double'));
alter table public.bookings alter column fee_model set default 'double';

/** Valor do Host pelo aluguel com preço por hora e diária como teto. */
create or replace function public.rental_host_amount_hourly(p_hourly numeric, p_daily numeric, p_start timestamptz, p_end timestamptz)
returns numeric language sql immutable set search_path = '' as $$
  with t as (select extract(epoch from (p_end - p_start)) / 3600.0 as hours)
  select round(
    floor(hours / 24) * p_daily + least(p_daily, (hours - floor(hours / 24) * 24) * p_hourly), 2)
  from t
$$;

-- Reserva nova: o valor do Host sai do preço por hora do anúncio (roda depois de bookings_times).
create or replace function public.bookings_u_preco()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  e public.equipment;
begin
  select * into e from public.equipment where id = new.equipment_id;
  if e.hourly_price is not null and new.start_at is not null and new.end_at is not null then
    new.host_hourly_price := e.hourly_price;
    new.host_amount := greatest(0.01, public.rental_host_amount_hourly(e.hourly_price, new.host_daily_price, new.start_at, new.end_at));
  end if;
  return new;
end;
$$;
create trigger bookings_u_preco before insert on public.bookings
  for each row execute function public.bookings_u_preco();
revoke execute on function public.bookings_u_preco() from public, anon, authenticated;

grant insert (hourly_price) on public.equipment to authenticated;

-- Busca: devolve também o preço por hora.
drop function public.listings(uuid);
create function public.listings(p_id uuid default null)
returns table (
  id uuid, host_id uuid, type text, title text, description text, daily_price numeric, hourly_price numeric,
  city text, area text, latitude double precision, longitude double precision,
  pickup_time time, return_time time, is_available boolean, photos text[],
  rating_avg numeric, rating_count integer,
  host_name text, host_verified boolean, host_since smallint,
  host_rating_avg numeric, host_rating_count integer
)
language sql stable security definer set search_path = '' as $$
  select
    e.id, e.host_id, e.type, e.title, e.description, e.daily_price, e.hourly_price,
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
grant execute on function public.listings(uuid) to anon, authenticated;

-- Edição do anúncio: preço por hora pode mudar.
create or replace function public.submit_listing_edit(p_id uuid, p_changes jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  e public.equipment;
  allowed text[] := array['type', 'title', 'description', 'daily_price', 'hourly_price', 'city', 'area',
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

create or replace function public.apply_listing_changes(p_id uuid, c jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.equipment set
    type = coalesce(c ->> 'type', type),
    title = coalesce(c ->> 'title', title),
    description = coalesce(c ->> 'description', description),
    daily_price = coalesce((c ->> 'daily_price')::numeric, daily_price),
    hourly_price = coalesce((c ->> 'hourly_price')::numeric, hourly_price),
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

-- Simulador: preço médio por hora na cidade.
drop function public.city_demand_summary(text);
create function public.city_demand_summary(p_city text)
returns table (trips_90 bigint, equipment bigint, avg_daily numeric, avg_hourly numeric)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*) from public.rider_trips t
      where public.city_key(t.city) = public.city_key(p_city)
        and t.until_day >= public.today_sp() and t.from_day <= public.today_sp() + 90),
    (select count(*) from public.equipment e
      where e.review_status = 'approved' and e.is_available and public.city_key(e.city) = public.city_key(p_city)),
    (select round(avg(e.daily_price), 2) from public.equipment e
      where e.review_status = 'approved' and public.city_key(e.city) = public.city_key(p_city)),
    (select round(avg(e.hourly_price), 2) from public.equipment e
      where e.review_status = 'approved' and public.city_key(e.city) = public.city_key(p_city))
$$;
revoke execute on function public.city_demand_summary(text) from public, anon;
grant execute on function public.city_demand_summary(text) to authenticated;
