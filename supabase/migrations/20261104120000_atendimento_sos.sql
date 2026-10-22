-- =============================================================================
-- Central de ajuda e SOS (decisão de 22/10/2026)
-- -----------------------------------------------------------------------------
-- - "Falar com a equipe": a pessoa abre um atendimento e troca mensagens com a
--   equipe Hi Scoot (fica tudo salvo). A IA entra depois neste mesmo chat.
-- - SOS durante o uso (da retirada à devolução): acidente, furto, defeito ou
--   outro problema, com localização opcional. Avisa na hora a equipe e o Host.
-- =============================================================================

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete set null,
  kind text not null default 'help' check (kind in ('help', 'sos')),
  topic text not null check (topic in ('payment', 'booking', 'handoff', 'damage', 'identity', 'host', 'other',
                                        'accident', 'theft', 'breakdown')),
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_tickets_user_idx on public.support_tickets (user_id, updated_at desc);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  from_team boolean not null default false,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index support_messages_ticket_idx on public.support_messages (ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
create policy "Atendimentos: a pessoa vê os seus; a equipe vê todos" on public.support_tickets
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "Mensagens do atendimento: a pessoa vê as suas; a equipe vê todas" on public.support_messages
  for select to authenticated using (
    public.is_admin() or exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid()));
revoke insert, update, delete on public.support_tickets, public.support_messages from anon, authenticated;
revoke select on public.support_tickets, public.support_messages from anon;

-- O Host vê o SOS das reservas dele (para agir junto).
create policy "SOS: o Host da reserva vê" on public.support_tickets
  for select to authenticated using (
    kind = 'sos' and exists (select 1 from public.bookings b where b.id = booking_id and b.host_id = auth.uid()));

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'bookingRequest', 'bookingAccepted', 'bookingRejected', 'paymentConfirmed', 'pickupReminder',
  'returnConfirmed', 'reviewReceived', 'listingApproved', 'listingRejected',
  'documentApproved', 'documentRejected', 'newMessage', 'equipmentAvailable',
  'pickupWaiting', 'returnWaiting', 'bookingExpired', 'cityAvailable', 'hostDemand',
  'supportNew', 'supportReply', 'sosAlert'));

/** Avisa toda a equipe (contas de admin). */
create or replace function public.notify_team(p_kind text, p_href text, p_name text, p_title text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, href, name, title, needs_action)
  select pp.id, p_kind, p_href, p_name, p_title, true
  from public.profile_private pp join public.profiles p on p.id = pp.id
  where pp.is_admin and p.deleted_at is null
$$;
revoke execute on function public.notify_team(text, text, text, text) from public, anon, authenticated;

/** Abre um atendimento com a primeira mensagem. Devolve o id. */
create or replace function public.open_support_ticket(p_topic text, p_body text, p_booking uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles;
  t_id uuid;
begin
  select * into me from public.profiles where id = auth.uid() and deleted_at is null;
  if me.id is null then raise exception 'not_allowed'; end if;
  if p_booking is not null and not exists (select 1 from public.bookings where id = p_booking and (rider_id = me.id or host_id = me.id)) then
    raise exception 'not_allowed';
  end if;
  if (select count(*) from public.support_tickets where user_id = me.id and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'too_many';
  end if;
  insert into public.support_tickets (user_id, booking_id, kind, topic)
    values (me.id, p_booking, 'help', p_topic) returning id into t_id;
  insert into public.support_messages (ticket_id, author_id, body) values (t_id, me.id, btrim(p_body));
  perform public.notify_team('supportNew', '/admin/support/' || t_id, me.display_name, left(btrim(p_body), 80));
  return t_id;
end;
$$;

/** Nova mensagem num atendimento (a pessoa dona ou a equipe). */
create or replace function public.send_support_message(p_ticket uuid, p_body text, p_close boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare
  t public.support_tickets;
  team boolean := public.is_admin();
  me_name text;
begin
  select * into t from public.support_tickets where id = p_ticket for update;
  if t.id is null or not (t.user_id = auth.uid() or team) then raise exception 'not_allowed'; end if;
  if char_length(btrim(coalesce(p_body, ''))) = 0 and not (team and p_close) then raise exception 'empty'; end if;
  if char_length(btrim(coalesce(p_body, ''))) > 0 then
    insert into public.support_messages (ticket_id, author_id, from_team, body)
      values (t.id, auth.uid(), team and t.user_id <> auth.uid(), btrim(p_body));
  end if;
  update public.support_tickets
     set updated_at = now(),
         status = case when team and p_close then 'closed' when team and t.user_id <> auth.uid() then 'answered' else 'open' end
   where id = t.id;
  select display_name into me_name from public.profiles where id = auth.uid();
  if team and t.user_id <> auth.uid() then
    insert into public.notifications (user_id, kind, href, name, title, needs_action)
      values (t.user_id, 'supportReply', '/help/' || t.id, 'Hi Scoot', left(btrim(coalesce(p_body, '')), 80), false);
  else
    perform public.notify_team('supportNew', '/admin/support/' || t.id, me_name, left(btrim(p_body), 80));
  end if;
end;
$$;

/**
 * SOS durante o uso: só o Rider de uma reserva em uso (ou confirmada no dia).
 * Avisa a equipe e o Host na hora.
 */
create or replace function public.report_sos(p_booking uuid, p_topic text, p_body text, p_lat double precision default null, p_lng double precision default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  t_id uuid;
  eq_title text;
  me_name text;
begin
  select * into b from public.bookings where id = p_booking;
  if b.id is null or b.rider_id is distinct from auth.uid() or b.status not in ('active', 'confirmed') then
    raise exception 'not_allowed';
  end if;
  if p_topic not in ('accident', 'theft', 'breakdown', 'other') then raise exception 'not_allowed'; end if;
  select title into eq_title from public.equipment where id = b.equipment_id;
  select display_name into me_name from public.profiles where id = b.rider_id;
  insert into public.support_tickets (user_id, booking_id, kind, topic, latitude, longitude)
    values (b.rider_id, b.id, 'sos', p_topic, p_lat, p_lng) returning id into t_id;
  insert into public.support_messages (ticket_id, author_id, body)
    values (t_id, b.rider_id, coalesce(nullif(btrim(coalesce(p_body, '')), ''), 'SOS'));
  perform public.notify_team('sosAlert', '/admin/support/' || t_id, me_name, eq_title);
  insert into public.notifications (user_id, kind, href, name, title, needs_action)
    values (b.host_id, 'sosAlert', '/host/reservations#' || b.id, me_name, eq_title, true);
  return t_id;
end;
$$;

revoke execute on function public.open_support_ticket(text, text, uuid) from public, anon;
revoke execute on function public.send_support_message(uuid, text, boolean) from public, anon;
revoke execute on function public.report_sos(uuid, text, text, double precision, double precision) from public, anon;
grant execute on function public.open_support_ticket(text, text, uuid) to authenticated;
grant execute on function public.send_support_message(uuid, text, boolean) to authenticated;
grant execute on function public.report_sos(uuid, text, text, double precision, double precision) to authenticated;
