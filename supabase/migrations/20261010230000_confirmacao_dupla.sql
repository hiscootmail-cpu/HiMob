-- =============================================================================
-- Hi Scoot · Retirada e devolução: os dois confirmam (decisão de 10/10/2026)
-- =============================================================================
-- - A reserva só passa para "em uso" (retirada) ou "concluída" (devolução)
--   quando o Rider (código da etiqueta + foto) E o Host (foto) confirmam.
-- - Quem confirma primeiro faz a outra pessoa receber um aviso: "Falta você".
-- - Se a outra pessoa não confirmar em 2 horas, a reserva entra na fila da
--   equipe ("Retiradas e devoluções"). A equipe pode "Confirmar pela
--   plataforma", com motivo obrigatório.
-- =============================================================================

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'bookingRequest', 'bookingAccepted', 'bookingRejected', 'paymentConfirmed', 'pickupReminder',
  'returnConfirmed', 'reviewReceived', 'listingApproved', 'listingRejected',
  'documentApproved', 'documentRejected', 'newMessage', 'equipmentAvailable',
  'pickupWaiting', 'returnWaiting'));

-- Prazo para a outra pessoa confirmar antes de a equipe verificar.
create or replace function public.handoff_wait()
returns interval language sql immutable set search_path = '' as $$
  select interval '2 hours'
$$;

-- Decisões da equipe quando só um lado confirmou.
create table public.handoff_resolutions (
  booking_id uuid not null references public.bookings (id) on delete cascade,
  kind text not null check (kind in ('pickup', 'return')),
  admin_id uuid not null references public.profiles (id),
  reason text not null check (char_length(reason) between 10 and 500),
  created_at timestamptz not null default now(),
  primary key (booking_id, kind)
);
alter table public.handoff_resolutions enable row level security;
create policy "Verificação da equipe: as duas pessoas da reserva e a equipe"
  on public.handoff_resolutions for select to authenticated
  using (public.in_booking(booking_id) or public.is_admin());
revoke insert, update, delete on public.handoff_resolutions from anon, authenticated;
revoke select on public.handoff_resolutions from anon;

-- Situação seguinte quando a etapa termina.
create or replace function public.handoff_next(p_kind text)
returns text language sql immutable set search_path = '' as $$
  select case p_kind when 'pickup' then 'active' when 'return' then 'completed' end
$$;

-- Avisos de devolução concluída (avaliações abrem).
create or replace function public.notify_return_done(b public.bookings)
returns void language plpgsql security definer set search_path = '' as $$
declare
  eq_title text;
begin
  select title into eq_title from public.equipment where id = b.equipment_id;
  insert into public.notifications (user_id, kind, href, title, needs_action) values
    (b.rider_id, 'returnConfirmed', '/rider/reservations/' || b.id || '/review', eq_title, true),
    (b.host_id, 'returnConfirmed', '/host/reservations#' || b.id, eq_title, true);
end;
$$;
revoke execute on function public.notify_return_done(public.bookings) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Confirmar retirada ou devolução (Rider: código + foto; Host: foto)
-- Devolve 'done' quando os dois já confirmaram, ou 'waiting'.
-- -----------------------------------------------------------------------------
drop function public.confirm_handoff(uuid, text, text, text);
create function public.confirm_handoff(p_id uuid, p_kind text, p_photo text, p_code text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  who text;
  expected text := case p_kind when 'pickup' then 'confirmed' when 'return' then 'active' end;
  label text;
  first_time boolean;
  my_name text;
  other uuid;
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

  first_time := not exists (select 1 from public.handoffs h where h.booking_id = p_id and h.kind = p_kind and h.by_role = who);
  insert into public.handoffs (booking_id, kind, by_role, photo_path)
    values (p_id, p_kind, who, p_photo)
    on conflict (booking_id, kind, by_role) do update set photo_path = excluded.photo_path, created_at = now();

  -- Os dois confirmaram: a reserva segue.
  if (select count(distinct by_role) from public.handoffs h where h.booking_id = p_id and h.kind = p_kind) = 2 then
    update public.bookings set status = public.handoff_next(p_kind) where id = p_id;
    if p_kind = 'return' then
      perform public.notify_return_done(b);
    end if;
    return 'done';
  end if;

  -- Falta a outra pessoa: ela recebe um aviso (só na primeira confirmação).
  if first_time then
    select display_name into my_name from public.profiles where id = auth.uid();
    other := case who when 'rider' then b.host_id else b.rider_id end;
    insert into public.notifications (user_id, kind, href, name, needs_action)
      values (other, case p_kind when 'pickup' then 'pickupWaiting' else 'returnWaiting' end,
              case who when 'rider' then '/host/reservations#' || p_id
                       else '/rider/reservations/' || p_id || '/' || p_kind end,
              my_name, true);
  end if;
  return 'waiting';
end;
$$;

-- -----------------------------------------------------------------------------
-- Fila da equipe: só um lado confirmou há mais de 2 horas
-- -----------------------------------------------------------------------------
create or replace function public.handoff_queue()
returns table (
  booking_id uuid, kind text, equipment_title text, equipment_type text,
  rider_id uuid, rider_name text, host_id uuid, host_name text,
  confirmed_by text, confirmed_at timestamptz, photo_path text,
  start_date date, end_date date, pickup_time time, return_time time
)
language sql stable security definer set search_path = '' as $$
  select b.id, h.kind, e.title, e.type,
         b.rider_id, pr.display_name, b.host_id, ph.display_name,
         h.by_role, h.created_at, h.photo_path,
         b.start_date, b.end_date, b.pickup_time, b.return_time
    from public.handoffs h
    join public.bookings b on b.id = h.booking_id
    join public.equipment e on e.id = b.equipment_id
    join public.profiles pr on pr.id = b.rider_id
    join public.profiles ph on ph.id = b.host_id
   where public.is_admin()
     and b.status = case h.kind when 'pickup' then 'confirmed' else 'active' end
     and h.created_at < now() - public.handoff_wait()
     and not exists (
       select 1 from public.handoffs o
        where o.booking_id = h.booking_id and o.kind = h.kind and o.by_role <> h.by_role)
   order by h.created_at
$$;

-- "Confirmar pela plataforma": a equipe confirma no lugar de quem não confirmou.
create or replace function public.admin_confirm_handoff(p_booking uuid, p_kind text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_reason text := public.require_reason(false, p_reason);
  expected text := case p_kind when 'pickup' then 'confirmed' when 'return' then 'active' end;
  b public.bookings;
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;
  select * into b from public.bookings where id = p_booking for update;
  if b.id is null or expected is null or b.status <> expected
     or not exists (select 1 from public.handoffs h where h.booking_id = p_booking and h.kind = p_kind) then
    raise exception 'not_allowed';
  end if;
  insert into public.handoff_resolutions (booking_id, kind, admin_id, reason)
    values (p_booking, p_kind, auth.uid(), v_reason);
  update public.bookings set status = public.handoff_next(p_kind) where id = p_booking;
  if p_kind = 'return' then
    perform public.notify_return_done(b);
  end if;
end;
$$;

revoke execute on function public.confirm_handoff(uuid, text, text, text) from public, anon;
revoke execute on function public.handoff_queue() from public, anon;
revoke execute on function public.admin_confirm_handoff(uuid, text, text) from public, anon;
grant execute on function public.confirm_handoff(uuid, text, text, text) to authenticated;
grant execute on function public.handoff_queue() to authenticated;
grant execute on function public.admin_confirm_handoff(uuid, text, text) to authenticated;
