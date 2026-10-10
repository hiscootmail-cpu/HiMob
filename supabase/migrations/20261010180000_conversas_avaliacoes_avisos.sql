-- =============================================================================
-- Hi Scoot · Etapa 5 do banco: conversas, avaliações e avisos
-- =============================================================================
-- - Conversas: o Rider começa sobre um anúncio publicado; mensagens chegam
--   na hora (tempo real) só para as duas pessoas; aviso de mensagem nova.
-- - Avaliações: depois da devolução, uma vez por reserva, de cada lado.
-- - Lembrete de retirada: todo dia de manhã, para as retiradas do dia seguinte.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Conversas
-- -----------------------------------------------------------------------------

-- "Falar com o Host": reaproveita a conversa sobre o anúncio ou começa uma nova.
create or replace function public.start_conversation(p_equipment uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  e public.equipment;
  me public.profiles;
  conv uuid;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null or me.identity_status = 'blocked' then
    raise exception 'not_allowed';
  end if;
  select * into e from public.equipment where id = p_equipment;
  if e.id is null or e.review_status <> 'approved' then
    raise exception 'not_allowed';
  end if;
  if e.host_id = me.id then
    raise exception 'own_listing';
  end if;
  insert into public.conversations (equipment_id, rider_id, host_id)
    values (e.id, me.id, e.host_id)
    on conflict (equipment_id, rider_id) do nothing;
  select id into conv from public.conversations where equipment_id = e.id and rider_id = me.id;
  return conv;
end;
$$;

-- Aviso de mensagem nova: um por conversa até a pessoa abrir os avisos.
create or replace function public.notify_new_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  x public.conversations;
  target uuid;
  link text;
  sender_name text;
begin
  select * into x from public.conversations where id = new.conversation_id;
  target := case when new.sender_id = x.rider_id then x.host_id else x.rider_id end;
  link := '/conversations/' || x.id;
  if not exists (
    select 1 from public.notifications n
     where n.user_id = target and n.kind = 'newMessage' and n.href = link and not n.read
  ) then
    select display_name into sender_name from public.profiles where id = new.sender_id;
    insert into public.notifications (user_id, kind, href, name, needs_action)
      values (target, 'newMessage', link, sender_name, true);
  end if;
  return new;
end;
$$;
create trigger messages_notify after insert on public.messages
  for each row execute function public.notify_new_message();

-- Tempo real: as mensagens novas chegam sozinhas (as regras de leitura continuam valendo).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
     ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Avaliações (depois da devolução, uma vez por reserva, de cada lado)
-- Rider avalia o Host (1 a 5) e o equipamento (1 a 5). Host avalia o Rider.
-- -----------------------------------------------------------------------------
create or replace function public.submit_review(
  p_booking uuid, p_rating integer, p_equipment_rating integer default null, p_comment text default ''
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  who text;
  target uuid;
  author_name text;
  v_comment text := btrim(coalesce(p_comment, ''));
begin
  select * into b from public.bookings where id = p_booking for update;
  if b.id is null then
    raise exception 'not_allowed';
  end if;
  who := case auth.uid() when b.rider_id then 'rider' when b.host_id then 'host' end;
  if who is null or b.status <> 'completed'
     or (who = 'rider' and b.rider_reviewed) or (who = 'host' and b.host_reviewed) then
    raise exception 'not_allowed';
  end if;
  if p_rating is null or p_rating not between 1 and 5
     or (who = 'rider' and (p_equipment_rating is null or p_equipment_rating not between 1 and 5)) then
    raise exception 'rating_required';
  end if;
  if char_length(v_comment) > 500 then
    raise exception 'comment_too_long';
  end if;

  target := case who when 'rider' then b.host_id else b.rider_id end;
  insert into public.reviews (booking_id, author_id, target_id, target_role, rating, equipment_rating, comment)
    values (b.id, auth.uid(), target, case who when 'rider' then 'host' else 'rider' end, p_rating,
            case who when 'rider' then p_equipment_rating end, v_comment);
  if who = 'rider' then
    update public.bookings set rider_reviewed = true where id = b.id;
  else
    update public.bookings set host_reviewed = true where id = b.id;
  end if;

  select display_name into author_name from public.profiles where id = auth.uid();
  insert into public.notifications (user_id, kind, href, name)
    values (target, 'reviewReceived', '/profile/' || target, author_name);
end;
$$;

-- -----------------------------------------------------------------------------
-- Lembrete de retirada: reservas pagas com retirada amanhã (horário de Brasília)
-- -----------------------------------------------------------------------------
create or replace function public.send_pickup_reminders()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  sent integer;
begin
  insert into public.notifications (user_id, kind, href, title)
    select b.rider_id, 'pickupReminder', '/rider/reservations/' || b.id, e.title
      from public.bookings b join public.equipment e on e.id = b.equipment_id
     where b.status = 'confirmed' and b.start_date = public.today_sp() + 1
       and not exists (
         select 1 from public.notifications n
          where n.user_id = b.rider_id and n.kind = 'pickupReminder' and n.href = '/rider/reservations/' || b.id
       );
  get diagnostics sent = row_count;
  return sent;
end;
$$;

-- Agenda diária às 9h de Brasília (12h UTC), se o agendador do banco (pg_cron)
-- existir. Se não der para ligar aqui, o resto da etapa segue normalmente.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      perform cron.schedule('lembrete-retirada', '0 12 * * *', 'select public.send_pickup_reminders()');
    exception when others then
      raise notice 'Lembrete de retirada não agendado: %', sqlerrm;
    end;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permissões
-- -----------------------------------------------------------------------------
revoke execute on function public.start_conversation(uuid) from public, anon;
revoke execute on function public.submit_review(uuid, integer, integer, text) from public, anon;
revoke execute on function public.send_pickup_reminders() from public, anon, authenticated;
revoke execute on function public.notify_new_message() from public, anon, authenticated;
grant execute on function public.start_conversation(uuid) to authenticated;
grant execute on function public.submit_review(uuid, integer, integer, text) to authenticated;
