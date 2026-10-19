-- =============================================================================
-- Hi Scoot · Mercado Pago (decisões de 19/10/2026)
-- =============================================================================
-- - Todo cadastro (Host ou Rider) conecta a conta Mercado Pago (OAuth).
-- - O Rider paga com PIX ou cartão à vista; o Mercado Pago divide o valor:
--   a parte da Hi Scoot fica com a Hi Scoot e o resto vai para o Host.
-- - A Hi Scoot paga a taxa do Mercado Pago.
-- - Host que cancela reserva paga: a taxa dele é descontada na próxima
--   reserva paga dele.
--
-- Chaves das contas Mercado Pago: só o servidor do site lê (chave secreta da
-- Supabase). Nenhuma pessoa conectada consegue ler esta tabela.
--
-- Enquanto o Mercado Pago não for ligado (app_settings.mercado_pago = 'on'),
-- tudo continua como antes, com o pagamento de teste.
-- =============================================================================

-- Chaves de funcionamento da plataforma (só a equipe muda, pelo painel da Supabase).
create table public.app_settings (
  key text primary key,
  value text not null
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
insert into public.app_settings (key, value) values ('mercado_pago', 'off');

create or replace function public.mp_required()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_settings where key = 'mercado_pago' and value = 'on')
$$;

-- -----------------------------------------------------------------------------
-- Contas Mercado Pago conectadas (OAuth)
-- -----------------------------------------------------------------------------
create table public.mp_accounts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  mp_user_id text not null,
  access_token text not null,
  refresh_token text not null,
  public_key text,
  expires_at timestamptz not null,
  live_mode boolean not null default false,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.mp_accounts enable row level security;
-- Sem regras de leitura: só o servidor (chave secreta) lê e grava.
revoke all on public.mp_accounts from anon, authenticated;

-- A pessoa já conectou o Mercado Pago? (sem revelar nenhuma chave)
create or replace function public.mp_connected(p_user uuid default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.mp_accounts a where a.user_id = coalesce(p_user, auth.uid()))
$$;

-- -----------------------------------------------------------------------------
-- Pagamentos de cada reserva
-- -----------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  mp_payment_id text unique,
  method text not null check (method in ('pix', 'card')),
  status text not null default 'pending',
  -- Total pago pelo Rider, parte da Hi Scoot (já sem a taxa do Mercado Pago)
  -- e quanto dessa parte veio de taxas antigas de cancelamento do Host.
  amount numeric(8, 2) not null check (amount > 0),
  application_fee numeric(8, 2) not null check (application_fee >= 0),
  debt_included numeric(8, 2) not null default 0,
  refunded numeric(8, 2) not null default 0,
  -- PIX: código "copia e cola" e QR (imagem), enquanto espera o pagamento.
  pix_code text,
  pix_qr_base64 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_booking_idx on public.payments (booking_id);
alter table public.payments enable row level security;
create policy "Pagamentos: as duas pessoas da reserva e a equipe"
  on public.payments for select to authenticated
  using (public.in_booking(booking_id) or public.is_admin());
revoke insert, update, delete on public.payments from anon, authenticated;
revoke select on public.payments from anon;

-- Taxa de 15% que o Host deve por ter cancelado uma reserva paga.
create table public.host_fee_debts (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  amount numeric(8, 2) not null check (amount > 0),
  settled_payment_id uuid references public.payments (id),
  created_at timestamptz not null default now(),
  unique (booking_id)
);
alter table public.host_fee_debts enable row level security;
create policy "Taxas pendentes: o próprio Host e a equipe"
  on public.host_fee_debts for select to authenticated
  using (host_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.host_fee_debts from anon, authenticated;
revoke select on public.host_fee_debts from anon;

-- Quanto o Host ainda deve (o servidor soma na parte da Hi Scoot do próximo pagamento).
create or replace function public.host_pending_debt(p_host uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(sum(amount), 0) from public.host_fee_debts where host_id = p_host and settled_payment_id is null
$$;

-- -----------------------------------------------------------------------------
-- Pedir reserva e aceitar: com o Mercado Pago ligado, as duas pessoas
-- precisam ter a conta conectada.
-- -----------------------------------------------------------------------------
create or replace function public.request_booking(p_equipment uuid, p_start date, p_end date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  e public.equipment;
  me public.profiles;
  new_id uuid;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null or me.identity_status = 'blocked' then
    raise exception 'not_allowed';
  end if;
  if public.mp_required() and not public.mp_connected(me.id) then
    raise exception 'mp_not_connected';
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

  -- O valor por dia e os horários ficam guardados como estavam no momento do pedido.
  insert into public.bookings (equipment_id, rider_id, host_id, start_date, end_date, host_daily_price, pickup_time, return_time)
  values (e.id, me.id, e.host_id, p_start, p_end, e.daily_price, e.pickup_time, e.return_time)
  returning id into new_id;

  insert into public.notifications (user_id, kind, href, name, title, needs_action)
    values (e.host_id, 'bookingRequest', '/host/reservations#' || new_id, me.display_name, e.title, true);
  return new_id;
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
    if public.mp_required() and not public.mp_connected(b.host_id) then
      raise exception 'mp_not_connected';
    end if;
    if b.start_date < public.today_sp() then
      raise exception 'not_allowed';
    end if;
    if public.dates_taken(b.equipment_id, b.start_date, b.end_date) then
      raise exception 'dates_taken';
    end if;
    begin
      update public.bookings set status = 'accepted' where id = p_id;
    exception when exclusion_violation then
      raise exception 'dates_taken';
    end;
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

-- Pagamento de teste: só enquanto o Mercado Pago não está ligado.
create or replace function public.pay_booking_test(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  eq_title text;
begin
  if public.mp_required() then
    raise exception 'not_allowed';
  end if;
  select * into b from public.bookings where id = p_id for update;
  if b.id is null or b.rider_id is distinct from auth.uid() or b.status <> 'accepted' then
    raise exception 'not_allowed';
  end if;
  update public.bookings set status = 'confirmed' where id = p_id;
  select title into eq_title from public.equipment where id = b.equipment_id;
  insert into public.notifications (user_id, kind, href, title) values
    (b.rider_id, 'paymentConfirmed', '/rider/reservations/' || p_id, eq_title),
    (b.host_id, 'paymentConfirmed', '/host/reservations#' || p_id, eq_title);
end;
$$;

-- -----------------------------------------------------------------------------
-- Pagamento aprovado pelo Mercado Pago (só o servidor chama, com a chave secreta)
-- -----------------------------------------------------------------------------
create or replace function public.confirm_payment(p_payment uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  p public.payments;
  b public.bookings;
  eq_title text;
begin
  select * into p from public.payments where id = p_payment for update;
  if p.id is null then
    raise exception 'not_found';
  end if;
  update public.payments set status = 'approved', updated_at = now(), pix_code = null, pix_qr_base64 = null where id = p.id;
  select * into b from public.bookings where id = p.booking_id for update;
  if b.status <> 'accepted' then
    -- Já confirmada (aviso repetido do Mercado Pago) ou cancelada antes: nada muda aqui.
    return false;
  end if;
  update public.bookings set status = 'confirmed' where id = b.id;
  -- Taxas antigas de cancelamento incluídas neste pagamento ficam quitadas.
  if p.debt_included > 0 then
    update public.host_fee_debts set settled_payment_id = p.id
     where host_id = b.host_id and settled_payment_id is null;
  end if;
  select title into eq_title from public.equipment where id = b.equipment_id;
  insert into public.notifications (user_id, kind, href, title) values
    (b.rider_id, 'paymentConfirmed', '/rider/reservations/' || b.id, eq_title),
    (b.host_id, 'paymentConfirmed', '/host/reservations#' || b.id, eq_title);
  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- Cancelar
-- Sem pagamento: a própria pessoa cancela (cancel_booking).
-- Reserva paga com o Mercado Pago ligado: o servidor confere quem pode
-- (cancel_check), devolve o dinheiro pelo Mercado Pago e só então registra
-- (cancel_paid_booking, só com a chave secreta).
-- -----------------------------------------------------------------------------
create or replace function public.cancel_check(p_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  b public.bookings;
  who text;
begin
  select * into b from public.bookings where id = p_id;
  if b.id is null then
    raise exception 'not_allowed';
  end if;
  who := case auth.uid() when b.rider_id then 'rider' when b.host_id then 'host' end;
  if who is null
     or (who = 'rider' and b.status not in ('pending', 'accepted', 'confirmed'))
     or (who = 'host' and b.status not in ('accepted', 'confirmed')) then
    raise exception 'not_allowed';
  end if;
  if b.status = 'confirmed' and now() > public.cancel_deadline(b) then
    raise exception 'deadline_passed';
  end if;
  return who;
end;
$$;

create or replace function public.cancel_booking(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  who text := public.cancel_check(p_id);
begin
  select * into b from public.bookings where id = p_id for update;
  if b.status = 'confirmed' and public.mp_required() then
    raise exception 'refund_required';
  end if;
  update public.bookings set status = 'cancelled', cancelled_by = who where id = p_id;
end;
$$;

create or replace function public.cancel_paid_booking(p_id uuid, p_who text, p_refunded numeric, p_host_debt numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
begin
  select * into b from public.bookings where id = p_id for update;
  if b.id is null or b.status <> 'confirmed' or p_who not in ('rider', 'host') then
    raise exception 'not_allowed';
  end if;
  update public.bookings set status = 'cancelled', cancelled_by = p_who where id = p_id;
  update public.payments set refunded = refunded + coalesce(p_refunded, 0), updated_at = now()
   where booking_id = p_id and status = 'approved';
  if coalesce(p_host_debt, 0) > 0 then
    insert into public.host_fee_debts (host_id, booking_id, amount) values (b.host_id, p_id, round(p_host_debt, 2));
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permissões
-- -----------------------------------------------------------------------------
revoke execute on function public.mp_required() from public, anon;
revoke execute on function public.mp_connected(uuid) from public, anon;
revoke execute on function public.host_pending_debt(uuid) from public, anon, authenticated;
revoke execute on function public.confirm_payment(uuid) from public, anon, authenticated;
revoke execute on function public.cancel_paid_booking(uuid, text, numeric, numeric) from public, anon, authenticated;
revoke execute on function public.cancel_check(uuid) from public, anon;
grant execute on function public.mp_required() to authenticated;
grant execute on function public.mp_connected(uuid) to authenticated;
grant execute on function public.cancel_check(uuid) to authenticated;
grant execute on function public.host_pending_debt(uuid) to service_role;
grant execute on function public.confirm_payment(uuid) to service_role;
grant execute on function public.cancel_paid_booking(uuid, text, numeric, numeric) to service_role;
grant all on public.mp_accounts, public.payments, public.host_fee_debts, public.app_settings to service_role;
