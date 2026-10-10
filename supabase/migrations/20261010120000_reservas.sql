-- =============================================================================
-- Hi Scoot · Etapa 4 do banco: reservas de verdade
-- =============================================================================
-- Pedir, aceitar/recusar, pagar (PROVISÓRIO: pagamento de teste), cancelar,
-- retirada e devolução com QR + foto, e dias bloqueados no calendário.
-- Cada função confere quem está pedindo e as regras aprovadas antes de gravar.
-- Horários em Brasília (America/Sao_Paulo).
-- =============================================================================

-- Hoje em São Paulo.
create or replace function public.today_sp()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

-- -----------------------------------------------------------------------------
-- Dias fora da reserva, separando reservados e bloqueados pelo Host
-- -----------------------------------------------------------------------------
drop function if exists public.unavailable_days(uuid);
create function public.unavailable_days(eq uuid)
returns table (day date, kind text) language sql stable security definer set search_path = '' as $$
  select d::date, 'booked'
    from public.bookings x,
         generate_series(x.start_date, x.end_date, interval '1 day') d
   where x.equipment_id = eq and x.status in ('accepted', 'confirmed', 'active') and d::date >= public.today_sp()
  union
  select b.day, 'blocked' from public.blocked_days b
   where b.equipment_id = eq and b.day >= public.today_sp()
     and not exists (
       select 1 from public.bookings x
        where x.equipment_id = eq and x.status in ('accepted', 'confirmed', 'active')
          and b.day between x.start_date and x.end_date)
  order by 1
$$;

-- Algum dia do período já está reservado ou bloqueado?
create or replace function public.dates_taken(eq uuid, p_start date, p_end date)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.bookings x
     where x.equipment_id = eq and x.status in ('accepted', 'confirmed', 'active')
       and daterange(x.start_date, x.end_date, '[]') && daterange(p_start, p_end, '[]')
  ) or exists (
    select 1 from public.blocked_days b
     where b.equipment_id = eq and b.day between p_start and p_end
  )
$$;
revoke execute on function public.dates_taken(uuid, date, date) from public, anon, authenticated;

-- Dia reservado não pode ser bloqueado nem desbloqueado pelo Host (já está fechado).
create or replace function public.guard_blocked_day()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r record := case when tg_op = 'DELETE' then old else new end;
begin
  if exists (
    select 1 from public.bookings x
     where x.equipment_id = r.equipment_id and x.status in ('accepted', 'confirmed', 'active')
       and r.day between x.start_date and x.end_date
  ) then
    raise exception 'booked';
  end if;
  return r;
end;
$$;

create trigger blocked_days_guard
  before insert or delete on public.blocked_days
  for each row execute function public.guard_blocked_day();

-- Só anúncio publicado tem calendário.
drop policy "Dias bloqueados: o Host gerencia os próprios" on public.blocked_days;
create policy "Dias bloqueados: o Host vê os próprios"
  on public.blocked_days for select to authenticated
  using (public.owns_equipment(equipment_id));
create policy "Dias bloqueados: o Host bloqueia nos anúncios publicados"
  on public.blocked_days for insert to authenticated
  with check (
    public.owns_equipment(equipment_id) and day >= public.today_sp()
    and exists (select 1 from public.equipment e where e.id = equipment_id and e.review_status = 'approved')
  );
create policy "Dias bloqueados: o Host desbloqueia de hoje em diante"
  on public.blocked_days for delete to authenticated
  using (public.owns_equipment(equipment_id) and day >= public.today_sp());
revoke update on public.blocked_days from authenticated;

-- -----------------------------------------------------------------------------
-- Prazo de cancelamento: até 24 h antes do horário de retirada
-- -----------------------------------------------------------------------------
create or replace function public.cancel_deadline(b public.bookings)
returns timestamptz language sql immutable set search_path = '' as $$
  select ((b.start_date + b.pickup_time) at time zone 'America/Sao_Paulo') - interval '24 hours'
$$;

-- -----------------------------------------------------------------------------
-- Rider pede a reserva
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

-- -----------------------------------------------------------------------------
-- Host aceita ou recusa um pedido novo
-- -----------------------------------------------------------------------------
create or replace function public.decide_booking(p_id uuid, p_accept boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  eq_title text;
  host_name text;
begin
  select * into b from public.bookings where id = p_id for update;
  if b.id is null or b.host_id is distinct from auth.uid() or b.status <> 'pending' then
    raise exception 'not_allowed';
  end if;
  select title into eq_title from public.equipment where id = b.equipment_id;
  select display_name into host_name from public.profiles where id = b.host_id;

  if p_accept then
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

  update public.bookings set status = 'rejected' where id = p_id;
  insert into public.notifications (user_id, kind, href, title)
    values (b.rider_id, 'bookingRejected', '/rider/reservations/' || p_id, eq_title);
  return 'rejected';
end;
$$;

-- -----------------------------------------------------------------------------
-- PROVISÓRIO (decisão de 10/10/2026): pagamento de teste, sem cobrar nada.
-- Sai quando o Mercado Pago entrar: aí só o aviso do Mercado Pago confirma o pagamento.
-- -----------------------------------------------------------------------------
create or replace function public.pay_booking_test(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  eq_title text;
begin
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
-- Cancelar (regras de lib/cancellation.ts)
-- Rider: pedido novo ou aceito, sem custo; pago, até 24 h antes da retirada.
-- Host: aceito, sem custo; pago, até 24 h antes. Pedido novo o Host recusa.
-- Devoluções de dinheiro entram com o Mercado Pago.
-- -----------------------------------------------------------------------------
create or replace function public.cancel_booking(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  who text;
begin
  select * into b from public.bookings where id = p_id for update;
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
  update public.bookings set status = 'cancelled', cancelled_by = who where id = p_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Retirada e devolução: QR (Rider) + foto (Rider e Host)
-- Retirada: reserva paga → em uso. Devolução: em uso → concluída.
-- A primeira confirmação (do Rider ou do Host) muda a situação.
-- -----------------------------------------------------------------------------
create or replace function public.confirm_handoff(p_id uuid, p_kind text, p_photo text, p_code text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  who text;
  expected text := case p_kind when 'pickup' then 'confirmed' when 'return' then 'active' end;
  label text;
  eq_title text;
begin
  select * into b from public.bookings where id = p_id for update;
  if b.id is null or expected is null then
    raise exception 'not_allowed';
  end if;
  who := case auth.uid() when b.rider_id then 'rider' when b.host_id then 'host' end;
  if who is null then
    raise exception 'not_allowed';
  end if;
  if b.status <> expected then
    raise exception 'wrong_status';
  end if;

  -- O Rider prova que está com o equipamento: código da etiqueta colada nele.
  if who = 'rider' then
    select label_code into label from public.equipment_private where equipment_id = b.equipment_id;
    if p_code is null or upper(regexp_replace(p_code, '\s', '', 'g')) <> label then
      raise exception 'code_invalid';
    end if;
  end if;

  -- A foto precisa estar na pasta da própria pessoa e já ter sido enviada.
  if p_photo is null or split_part(p_photo, '/', 1) <> auth.uid()::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'handoff-photos' and o.name = p_photo) then
    raise exception 'photo_required';
  end if;

  insert into public.handoffs (booking_id, kind, by_role, photo_path)
    values (p_id, p_kind, who, p_photo)
    on conflict (booking_id, kind, by_role) do update set photo_path = excluded.photo_path, created_at = now();

  update public.bookings set status = case p_kind when 'pickup' then 'active' else 'completed' end where id = p_id;

  if p_kind = 'return' then
    select title into eq_title from public.equipment where id = b.equipment_id;
    insert into public.notifications (user_id, kind, href, title, needs_action) values
      (b.rider_id, 'returnConfirmed', '/rider/reservations/' || p_id || '/review', eq_title, true),
      (b.host_id, 'returnConfirmed', '/host/reservations#' || p_id, eq_title, true);
  end if;
end;
$$;

-- As duas pessoas da reserva veem as fotos de retirada e devolução dela.
create policy "Fotos de retirada: as duas pessoas da reserva"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'handoff-photos'
    and exists (select 1 from public.handoffs h where h.photo_path = objects.name and public.in_booking(h.booking_id))
  );

-- -----------------------------------------------------------------------------
-- Permissões
-- -----------------------------------------------------------------------------
revoke execute on function public.request_booking(uuid, date, date) from public, anon;
revoke execute on function public.decide_booking(uuid, boolean) from public, anon;
revoke execute on function public.pay_booking_test(uuid) from public, anon;
revoke execute on function public.cancel_booking(uuid) from public, anon;
revoke execute on function public.confirm_handoff(uuid, text, text, text) from public, anon;
grant execute on function public.request_booking(uuid, date, date) to authenticated;
grant execute on function public.decide_booking(uuid, boolean) to authenticated;
grant execute on function public.pay_booking_test(uuid) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
grant execute on function public.confirm_handoff(uuid, text, text, text) to authenticated;
