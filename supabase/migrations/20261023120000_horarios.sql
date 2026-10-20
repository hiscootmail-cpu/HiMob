-- =============================================================================
-- Hi Scoot · Dias disponíveis e aluguel por horas (decisões de 20/10/2026)
-- -----------------------------------------------------------------------------
-- - O Host LIBERA os dias em que vai alugar (botão "Dias disponíveis" no
--   anúncio). Equipamento começa sem nenhum dia liberado.
-- - Os horários do anúncio (pickup_time / return_time) passam a ser o horário
--   de atendimento do Host: "atende das __ às __".
-- - O Rider escolhe dia e hora de retirada e de devolução, de 30 em 30
--   minutos, dentro do atendimento. Mínimo de 1 hora.
-- - Duas pessoas podem alugar no mesmo dia, em horários que não se cruzam,
--   com 1 hora de intervalo entre um aluguel e o próximo.
-- - Preço: o Host informa a diária. Hora = diária ÷ horas de atendimento.
--   Até 24 h: horas usadas, sem passar de 1 diária. Cada 24 h a mais conta
--   1 diária; o que sobra conta por hora, sem passar de 1 diária.
-- =============================================================================

-- Dias liberados pelo Host ----------------------------------------------------
create table public.equipment_available_days (
  equipment_id uuid not null references public.equipment (id) on delete cascade,
  day date not null,
  primary key (equipment_id, day)
);
alter table public.equipment_available_days enable row level security;

create policy "Dias disponíveis: todos veem os de anúncios publicados"
  on public.equipment_available_days for select to anon, authenticated
  using (
    exists (select 1 from public.equipment e where e.id = equipment_id and e.review_status = 'approved')
    or public.owns_equipment(equipment_id) or public.is_admin()
  );
create policy "Dias disponíveis: o Host libera nos próprios anúncios"
  on public.equipment_available_days for insert to authenticated
  with check ((public.owns_equipment(equipment_id) or public.is_admin()) and day >= public.today_sp());
create policy "Dias disponíveis: o Host tira dos próprios anúncios"
  on public.equipment_available_days for delete to authenticated
  using ((public.owns_equipment(equipment_id) or public.is_admin()) and day >= public.today_sp());
revoke insert, update, delete on public.equipment_available_days from anon;
revoke update on public.equipment_available_days from authenticated;

-- Reservas com dia e hora -------------------------------------------------------
alter table public.bookings drop constraint bookings_no_overlap;
alter table public.bookings drop constraint if exists bookings_check;
alter table public.bookings drop constraint if exists bookings_check1;
do $$
declare c record;
begin
  -- A regra antiga "devolução depois do dia da retirada" sai: agora pode ser no mesmo dia.
  for c in select conname from pg_constraint
            where conrelid = 'public.bookings'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) like '%end_date > start_date%'
  loop
    execute format('alter table public.bookings drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.bookings
  add column start_at timestamptz,
  add column end_at timestamptz,
  -- Fim + 1 hora de intervalo (para carregar e conferir antes do próximo aluguel).
  add column busy_until timestamptz,
  -- Valor do Host por este aluguel (antes da taxa da plataforma).
  add column host_amount numeric(10, 2);

-- Início e fim no horário de Brasília, preenchidos a partir do dia e da hora.
create or replace function public.booking_times()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- Reserva gravada sem valor (só pela equipe, direto no banco): diárias x valor por dia.
  if new.host_amount is null then
    new.host_amount := greatest(new.end_date - new.start_date, 1) * new.host_daily_price;
  end if;
  new.start_at := (new.start_date + new.pickup_time) at time zone 'America/Sao_Paulo';
  new.end_at := (new.end_date + new.return_time) at time zone 'America/Sao_Paulo';
  new.busy_until := new.end_at + interval '1 hour';
  return new;
end;
$$;
create trigger bookings_times
  before insert or update of start_date, end_date, pickup_time, return_time on public.bookings
  for each row execute function public.booking_times();

-- Reservas antigas: dia da retirada no horário de retirada, dia da devolução
-- no horário de devolução, e valor = diárias x valor por dia.
update public.bookings set
  start_at = (start_date + pickup_time) at time zone 'America/Sao_Paulo',
  end_at = (end_date + return_time) at time zone 'America/Sao_Paulo',
  busy_until = ((end_date + return_time) at time zone 'America/Sao_Paulo') + interval '1 hour',
  host_amount = (end_date - start_date) * host_daily_price;

alter table public.bookings
  alter column start_at set not null,
  alter column end_at set not null,
  alter column busy_until set not null,
  alter column host_amount set not null,
  add constraint bookings_end_after_start check (end_at > start_at),
  add constraint bookings_host_amount_positive check (host_amount > 0),
  -- Dois aluguéis aceitos não se cruzam, com 1 hora de intervalo entre eles.
  add constraint bookings_no_overlap exclude using gist (
    equipment_id with =,
    tstzrange(start_at, busy_until, '[)') with &&
  ) where (status in ('accepted', 'confirmed', 'active'));

/** Valor do Host pelo aluguel (antes da taxa), pela regra de horas. */
create or replace function public.rental_host_amount(
  p_daily numeric, p_open_from time, p_open_until time, p_start timestamptz, p_end timestamptz
) returns numeric language sql immutable set search_path = '' as $$
  with t as (
    select extract(epoch from (p_end - p_start)) / 3600.0 as hours,
           case when p_open_until > p_open_from then extract(epoch from (p_open_until - p_open_from)) / 3600.0 else 24 end as open_hours
  )
  select round(floor(hours / 24) * p_daily + least(p_daily, (hours - 24 * floor(hours / 24)) * p_daily / open_hours), 2)
  from t
$$;

/** Algum aluguel aceito cruza este horário (contando 1 hora de intervalo)? */
create or replace function public.times_taken(eq uuid, p_start timestamptz, p_end timestamptz, p_except uuid default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.bookings x
     where x.equipment_id = eq and x.status in ('accepted', 'confirmed', 'active')
       and x.id is distinct from p_except
       and tstzrange(x.start_at, x.busy_until, '[)') && tstzrange(p_start, p_end + interval '1 hour', '[)')
  )
$$;

/** Todos os dias do período foram liberados pelo Host (e nenhum bloqueado)? */
create or replace function public.days_available(eq uuid, p_start date, p_end date)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from generate_series(p_start, p_end, interval '1 day') g(d)
     where not exists (select 1 from public.equipment_available_days a where a.equipment_id = eq and a.day = g.d::date)
        or exists (select 1 from public.blocked_days b where b.equipment_id = eq and b.day = g.d::date)
  )
$$;

/** Calendário do equipamento para o Rider: dias liberados e horários já ocupados. */
create or replace function public.equipment_schedule(eq uuid)
returns table (kind text, day date, start_at timestamptz, end_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select 'available', a.day, null::timestamptz, null::timestamptz
    from public.equipment_available_days a
    join public.equipment e on e.id = a.equipment_id and e.review_status = 'approved'
   where a.equipment_id = eq and a.day >= public.today_sp()
     and not exists (select 1 from public.blocked_days b where b.equipment_id = eq and b.day = a.day)
  union all
  select 'busy', null, x.start_at, x.end_at
    from public.bookings x
   where x.equipment_id = eq and x.status in ('accepted', 'confirmed', 'active') and x.end_at >= now()
$$;

-- Dia com aluguel aceito não pode deixar de estar disponível.
create or replace function public.guard_available_day()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.bookings x
     where x.equipment_id = old.equipment_id and x.status in ('accepted', 'confirmed', 'active')
       and old.day between x.start_date and x.end_date
  ) then
    raise exception 'day_booked';
  end if;
  return old;
end;
$$;
create trigger equipment_available_days_guard
  before delete on public.equipment_available_days
  for each row execute function public.guard_available_day();

-- Pedido de reserva com dia e hora ------------------------------------------------
create function public.request_booking(
  p_equipment uuid, p_start date, p_start_time time, p_end date, p_end_time time, p_coupon text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  e public.equipment;
  me public.profiles;
  c public.coupons;
  v_start timestamptz := (p_start + p_start_time) at time zone 'America/Sao_Paulo';
  v_end timestamptz := (p_end + p_end_time) at time zone 'America/Sao_Paulo';
  open_all_day boolean;
  new_id uuid;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null or me.identity_status = 'blocked' then
    raise exception 'not_allowed';
  end if;
  -- Só aluga depois da verificação de identidade (decisão de 19/10/2026).
  if me.identity_status <> 'approved' then
    raise exception 'identity_required';
  end if;
  select * into e from public.equipment where id = p_equipment;
  if e.id is null or e.review_status <> 'approved' or not e.is_available then
    raise exception 'unavailable';
  end if;
  if e.host_id = me.id then
    raise exception 'own_listing';
  end if;
  if p_start is null or p_end is null or p_start_time is null or p_end_time is null or v_start < now() then
    raise exception 'pickup_in_past';
  end if;
  if v_end <= v_start then
    raise exception 'return_before_pickup';
  end if;
  if v_end < v_start + interval '1 hour' then
    raise exception 'too_short';
  end if;
  -- De 30 em 30 minutos, dentro do horário de atendimento do Host.
  if extract(minute from p_start_time) not in (0, 30) or extract(minute from p_end_time) not in (0, 30)
     or extract(second from p_start_time) <> 0 or extract(second from p_end_time) <> 0 then
    raise exception 'time_invalid';
  end if;
  open_all_day := e.return_time <= e.pickup_time;
  if not open_all_day and (p_start_time < e.pickup_time or p_start_time >= e.return_time
                           or p_end_time <= e.pickup_time or p_end_time > e.return_time) then
    raise exception 'outside_hours';
  end if;
  if not public.days_available(p_equipment, p_start, p_end) then
    raise exception 'dates_unavailable';
  end if;
  if public.times_taken(p_equipment, v_start, v_end) then
    raise exception 'times_taken';
  end if;
  if nullif(btrim(coalesce(p_coupon, '')), '') is not null then
    -- Trava o cupom: dois pedidos ao mesmo tempo não passam do limite.
    c := public.coupon_for_booking(p_coupon, me.id, e.city, p_end - p_start + 1, true);
  end if;

  insert into public.bookings (equipment_id, rider_id, host_id, start_date, end_date, host_daily_price, pickup_time, return_time,
                               host_amount, coupon_id, coupon_code, free)
  values (e.id, me.id, e.host_id, p_start, p_end, e.daily_price, p_start_time, p_end_time,
          public.rental_host_amount(e.daily_price, e.pickup_time, e.return_time, v_start, v_end),
          c.id, c.code, coalesce(c.kind = 'free', false))
  returning id into new_id;

  insert into public.notifications (user_id, kind, href, name, title, needs_action)
    values (e.host_id, 'bookingRequest', '/host/reservations#' || new_id, me.display_name, e.title, true);
  return new_id;
end;
$$;

-- Versão antiga (só dias): retirada no início do atendimento do primeiro dia e
-- devolução no fim do atendimento do último dia. Fica para quem ainda chama assim.
create or replace function public.request_booking(p_equipment uuid, p_start date, p_end date, p_coupon text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare e public.equipment;
begin
  select * into e from public.equipment where id = p_equipment;
  if e.id is null then raise exception 'unavailable'; end if;
  return public.request_booking(p_equipment, p_start, e.pickup_time, p_end, e.return_time, p_coupon);
end;
$$;

/** Cupom: conta os dias do calendário da reserva (retirada e devolução no mesmo dia = 1). */
create or replace function public.check_coupon(p_code text, p_equipment uuid, p_start date, p_end date)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  e public.equipment;
  c public.coupons;
begin
  if auth.uid() is null then raise exception 'not_allowed'; end if;
  select * into e from public.equipment where id = p_equipment and review_status = 'approved';
  if e.id is null then raise exception 'unavailable'; end if;
  c := public.coupon_for_booking(p_code, auth.uid(), e.city,
         case when p_start is not null and p_end is not null and p_end >= p_start then p_end - p_start + 1 else 1 end);
  return c.kind;
end;
$$;

create or replace function public.decide_booking(p_id uuid, p_accept boolean, p_reason text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  eq_title text;
  host_name text;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  select * into b from public.bookings where id = p_id for update;
  if b.id is null or b.host_id is distinct from auth.uid() or b.status <> 'pending' then
    raise exception 'not_allowed';
  end if;
  select title into eq_title from public.equipment where id = b.equipment_id;
  select display_name into host_name from public.profiles where id = b.host_id;

  if p_accept then
    -- Reserva grátis (cupom de ação): ninguém recebe, então não precisa de Mercado Pago.
    if not b.free and public.mp_required() and not public.mp_connected(b.host_id) then
      raise exception 'mp_not_connected';
    end if;
    if b.start_at < now() then
      raise exception 'not_allowed';
    end if;
    if public.times_taken(b.equipment_id, b.start_at, b.end_at, b.id) or not public.days_available(b.equipment_id, b.start_date, b.end_date) then
      raise exception 'dates_taken';
    end if;
    begin
      update public.bookings set status = case when b.free then 'confirmed' else 'accepted' end where id = p_id;
    exception when exclusion_violation then
      raise exception 'dates_taken';
    end;
    if b.free then
      insert into public.notifications (user_id, kind, href, name, title, needs_action)
        values (b.rider_id, 'bookingAccepted', '/rider/reservations/' || p_id, host_name, eq_title, false);
      return 'confirmed';
    end if;
    insert into public.notifications (user_id, kind, href, name, title, needs_action)
      values (b.rider_id, 'bookingAccepted', '/rider/reservations/' || p_id || '/payment', host_name, eq_title, true);
    return 'accepted';
  end if;

  if char_length(v_reason) not between 5 and 100 then
    raise exception 'reason_required';
  end if;
  update public.bookings set status = 'rejected', reject_reason = v_reason where id = p_id;
  insert into public.notifications (user_id, kind, href, title)
    values (b.rider_id, 'bookingRejected', '/rider/reservations/' || p_id, eq_title);
  return 'rejected';
end;
$$;

revoke execute on function public.times_taken(uuid, timestamptz, timestamptz, uuid) from public, anon, authenticated;
revoke execute on function public.days_available(uuid, date, date) from public, anon, authenticated;
revoke execute on function public.request_booking(uuid, date, time, date, time, text) from public, anon;
revoke execute on function public.request_booking(uuid, date, date, text) from public, anon;
grant execute on function public.request_booking(uuid, date, time, date, time, text) to authenticated;
grant execute on function public.request_booking(uuid, date, date, text) to authenticated;
grant execute on function public.equipment_schedule(uuid) to anon, authenticated;
