-- =============================================================================
-- Hi Scoot · Motivo da recusa (decisão de 10/10/2026)
-- =============================================================================
-- O Host escreve um motivo curto ao recusar um pedido (ex.: "Vou usar o
-- equipamento", "Equipamento em manutenção"). O Rider vê o motivo na reserva.
-- =============================================================================

alter table public.bookings
  add column reject_reason text check (char_length(reject_reason) between 5 and 100);

drop function public.decide_booking(uuid, boolean);
create function public.decide_booking(p_id uuid, p_accept boolean, p_reason text default null)
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

revoke execute on function public.decide_booking(uuid, boolean, text) from public, anon;
grant execute on function public.decide_booking(uuid, boolean, text) to authenticated;
