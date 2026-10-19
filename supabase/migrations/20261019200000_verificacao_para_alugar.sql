-- =============================================================================
-- Hi Scoot · Só aluga e anuncia depois da verificação (decisão de 19/10/2026)
-- =============================================================================
-- Enquanto o documento está em análise, a pessoa só vê os equipamentos,
-- conversa e explora. Pedir reserva e criar anúncio exigem a identidade aprovada.
-- =============================================================================

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
  -- Só aluga depois da verificação de identidade (decisão de 19/10/2026).
  if me.identity_status <> 'approved' then
    raise exception 'identity_required';
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


drop policy "Anúncios: o Host cria (vai para análise)" on public.equipment;
create policy "Anúncios: o Host verificado cria (vai para análise)"
  on public.equipment for insert to authenticated
  with check (
    host_id = auth.uid() and review_status = 'pending' and review_reason is null
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_host and p.identity_status = 'approved')
  );
