-- =============================================================================
-- Hi Scoot · Cupons de aluguel (decisões de 20/10/2026)
-- -----------------------------------------------------------------------------
-- Primeiro uso: ações por cidade para as pessoas viverem a experiência
-- (ScootemMogi, ScootemJagua, ScootemSampa). O cupom deixa o aluguel grátis:
-- o equipamento das ações é da própria Hi Scoot ou de parceiros que topam
-- emprestar, ninguém recebe nada e a reserva fica confirmada sem pagamento
-- assim que o Host aceita.
-- - Cada cupom vale só na sua cidade (a cidade do anúncio).
-- - Qualquer pessoa com o cupom pode usar. Limites (total de usos, usos por
--   pessoa, dias por reserva, validade) são opcionais: a equipe preenche no
--   painel só se quiser.
-- - Só a equipe cria e vê os cupons. O Rider só digita o código.
-- Cupons de desconto (ex.: na taxa) e cupons da loja ficam para depois.
-- =============================================================================

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  -- Guardado em maiúsculas; a pessoa pode digitar de qualquer jeito.
  code text not null unique check (code ~ '^[A-Z0-9]{3,30}$'),
  kind text not null default 'free' check (kind in ('free')),
  city text check (city is null or char_length(btrim(city)) between 2 and 80),
  max_uses integer check (max_uses is null or max_uses between 1 and 100000),
  per_person integer check (per_person is null or per_person between 1 and 1000),
  max_days integer check (max_days is null or max_days between 1 and 60),
  valid_until date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.coupons enable row level security;
create policy "Cupons: só a equipe vê" on public.coupons for select to authenticated using (public.is_admin());
create policy "Cupons: só a equipe cria" on public.coupons for insert to authenticated with check (public.is_admin());
create policy "Cupons: só a equipe muda" on public.coupons for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Cupons: só a equipe apaga" on public.coupons for delete to authenticated using (public.is_admin());
revoke all on public.coupons from anon;

alter table public.bookings
  add column coupon_id uuid references public.coupons (id) on delete set null,
  -- Código e efeito guardados como estavam na hora da reserva.
  add column coupon_code text,
  add column free boolean not null default false;

/** Mesma cidade, sem diferença de maiúsculas, espaços ou acentos comuns. */
create or replace function public.same_city(a text, b text)
returns boolean language sql immutable set search_path = '' as $$
  select translate(lower(btrim(coalesce(a, ''))), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')
       = translate(lower(btrim(coalesce(b, ''))), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')
$$;

/**
 * Confere se o cupom vale para esta reserva. Devolve o cupom ou levanta o
 * motivo: coupon_invalid, coupon_city, coupon_used_up, coupon_already_used,
 * coupon_days.
 */
create or replace function public.coupon_for_booking(p_code text, p_rider uuid, p_city text, p_days integer, p_lock boolean default false)
returns public.coupons language plpgsql security definer set search_path = '' as $$
declare
  c public.coupons;
  used integer;
begin
  if p_lock then
    select * into c from public.coupons where code = upper(btrim(p_code)) for update;
  else
    select * into c from public.coupons where code = upper(btrim(p_code));
  end if;
  if c.id is null or not c.active or (c.valid_until is not null and c.valid_until < public.today_sp()) then
    raise exception 'coupon_invalid';
  end if;
  if c.city is not null and not public.same_city(c.city, p_city) then
    raise exception 'coupon_city';
  end if;
  if c.max_days is not null and p_days > c.max_days then
    raise exception 'coupon_days';
  end if;
  if c.max_uses is not null then
    select count(*) into used from public.bookings where coupon_id = c.id and status not in ('rejected', 'cancelled');
    if used >= c.max_uses then raise exception 'coupon_used_up'; end if;
  end if;
  if c.per_person is not null then
    select count(*) into used from public.bookings
     where coupon_id = c.id and rider_id = p_rider and status not in ('rejected', 'cancelled');
    if used >= c.per_person then raise exception 'coupon_already_used'; end if;
  end if;
  return c;
end;
$$;

/** Para a tela de reserva conferir o cupom antes de enviar o pedido. Devolve o tipo ('free'). */
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
         case when p_start is not null and p_end is not null and p_end > p_start then p_end - p_start else 1 end);
  return c.kind;
end;
$$;

-- Pedido de reserva com cupom (opcional). Substitui a versão sem cupom.
drop function public.request_booking(uuid, date, date);
create function public.request_booking(p_equipment uuid, p_start date, p_end date, p_coupon text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  e public.equipment;
  me public.profiles;
  c public.coupons;
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
  if p_start is null or p_end is null or p_start < public.today_sp() then
    raise exception 'pickup_in_past';
  end if;
  if p_end <= p_start then
    raise exception 'return_before_pickup';
  end if;
  if public.dates_taken(p_equipment, p_start, p_end) then
    raise exception 'dates_unavailable';
  end if;
  if nullif(btrim(coalesce(p_coupon, '')), '') is not null then
    -- Trava o cupom: dois pedidos ao mesmo tempo não passam do limite.
    c := public.coupon_for_booking(p_coupon, me.id, e.city, p_end - p_start, true);
  end if;

  -- O valor por dia e os horários ficam guardados como estavam no momento do pedido.
  insert into public.bookings (equipment_id, rider_id, host_id, start_date, end_date, host_daily_price, pickup_time, return_time,
                               coupon_id, coupon_code, free)
  values (e.id, me.id, e.host_id, p_start, p_end, e.daily_price, e.pickup_time, e.return_time,
          c.id, c.code, coalesce(c.kind = 'free', false))
  returning id into new_id;

  insert into public.notifications (user_id, kind, href, name, title, needs_action)
    values (e.host_id, 'bookingRequest', '/host/reservations#' || new_id, me.display_name, e.title, true);
  return new_id;
end;
$$;

-- Aceitar reserva com cupom grátis: já fica confirmada, sem pagamento.
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
    if b.start_date < public.today_sp() then
      raise exception 'not_allowed';
    end if;
    if public.dates_taken(b.equipment_id, b.start_date, b.end_date) then
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

-- Cancelar reserva grátis: não tem dinheiro para devolver.
create or replace function public.cancel_booking(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  who text := public.cancel_check(p_id);
begin
  select * into b from public.bookings where id = p_id for update;
  if b.status = 'confirmed' and not b.free and public.mp_required() then
    raise exception 'refund_required';
  end if;
  update public.bookings set status = 'cancelled', cancelled_by = who where id = p_id;
end;
$$;

revoke execute on function public.coupon_for_booking(text, uuid, text, integer, boolean) from public, anon, authenticated;
revoke execute on function public.check_coupon(text, uuid, date, date) from public, anon;
revoke execute on function public.request_booking(uuid, date, date, text) from public, anon;
grant execute on function public.check_coupon(text, uuid, date, date) to authenticated;
grant execute on function public.request_booking(uuid, date, date, text) to authenticated;
