-- =============================================================================
-- Hi Scoot · Ajustes para operar (20/10/2026)
-- =============================================================================
-- 1) Equipamentos da própria Hi Scoot (Host = conta da equipe): o pagamento
--    das reservas cai direto na conta Mercado Pago da Hi Scoot (como na loja),
--    então aceitar pedido não pede a conexão de conta Mercado Pago.
-- 2) Tamanhos da loja: tira itens que não são tamanho (ex.: "-").
-- =============================================================================

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
    -- Equipamento da Hi Scoot (Host da equipe): recebe na conta da própria Hi Scoot.
    if not b.free and not public.is_admin() and public.mp_required() and not public.mp_connected(b.host_id) then
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

update public.world_products
   set sizes = coalesce((select array_agg(s order by ord) from unnest(sizes) with ordinality u(s, ord) where s ~ '^[A-Z0-9]+$'), '{}')
 where exists (select 1 from unnest(sizes) s where s !~ '^[A-Z0-9]+$');
