-- =============================================================================
-- Hi Scoot · Cupom de desconto: x% no aluguel e y% na taxa (20/10/2026)
-- -----------------------------------------------------------------------------
-- Além do "aluguel grátis", o cupom pode dar desconto em porcentagem:
-- - x% no aluguel: sai da parte do Host (no pagamento dividido do Mercado
--   Pago, a Hi Scoot não consegue completar o valor do Host);
-- - y% na taxa de 15%: sai da parte da Hi Scoot.
-- A reserva guarda as duas porcentagens como estavam na hora do pedido.
-- 100% nas duas = aluguel grátis (confirmado sem pagamento).
-- =============================================================================

alter table public.coupons drop constraint if exists coupons_kind_check;
alter table public.coupons
  add constraint coupons_kind_check check (kind in ('free', 'discount')),
  add column rental_percent smallint not null default 0 check (rental_percent between 0 and 100),
  add column fee_percent smallint not null default 0 check (fee_percent between 0 and 100),
  add constraint coupons_discount_has_percent check (kind <> 'discount' or rental_percent > 0 or fee_percent > 0);

alter table public.bookings
  add column coupon_rental_percent smallint not null default 0 check (coupon_rental_percent between 0 and 100),
  add column coupon_fee_percent smallint not null default 0 check (coupon_fee_percent between 0 and 100);

/** Para a tela de reserva: tipo do cupom e as porcentagens de desconto. */
create or replace function public.coupon_preview(p_code text, p_equipment uuid, p_start date, p_end date)
returns table (kind text, rental_percent smallint, fee_percent smallint)
language plpgsql stable security definer set search_path = '' as $$
declare
  e public.equipment;
  c public.coupons;
begin
  if auth.uid() is null then raise exception 'not_allowed'; end if;
  select * into e from public.equipment where id = p_equipment and review_status = 'approved';
  if e.id is null then raise exception 'unavailable'; end if;
  c := public.coupon_for_booking(p_code, auth.uid(), e.city,
         case when p_start is not null and p_end is not null and p_end >= p_start then p_end - p_start + 1 else 1 end);
  return query select c.kind, c.rental_percent, c.fee_percent;
end;
$$;
revoke execute on function public.coupon_preview(text, uuid, date, date) from public, anon;
grant execute on function public.coupon_preview(text, uuid, date, date) to authenticated;

create or replace function public.request_booking(
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
                               host_amount, coupon_id, coupon_code, free, coupon_rental_percent, coupon_fee_percent)
  values (e.id, me.id, e.host_id, p_start, p_end, e.daily_price, p_start_time, p_end_time,
          public.rental_host_amount(e.daily_price, e.pickup_time, e.return_time, v_start, v_end),
          c.id, c.code,
          coalesce(c.kind = 'free' or (c.rental_percent = 100 and c.fee_percent = 100), false),
          case when c.kind = 'discount' then c.rental_percent else 0 end,
          case when c.kind = 'discount' then c.fee_percent else 0 end)
  returning id into new_id;

  insert into public.notifications (user_id, kind, href, name, title, needs_action)
    values (e.host_id, 'bookingRequest', '/host/reservations#' || new_id, me.display_name, e.title, true);
  return new_id;
end;
$$;
