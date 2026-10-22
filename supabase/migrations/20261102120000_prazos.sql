-- =============================================================================
-- Prazos de resposta e de pagamento (decisão de 22/10/2026)
-- -----------------------------------------------------------------------------
-- - O Host responde o pedido em até 20 minutos quando a retirada é no mesmo dia
--   e em até 24 horas quando é agendada (nunca depois do horário da retirada).
-- - Depois do aceite, o Rider paga em até 10 minutos.
-- - Passou o prazo: a reserva vence ("expired"), os horários voltam a ficar
--   livres e as duas pessoas são avisadas. O Rider pode conversar com o Host e
--   pedir de novo.
-- - Reserva com pagamento em andamento ou aprovado não vence.
-- =============================================================================

do $$
declare c record;
begin
  for c in select conname from pg_constraint
            where conrelid = 'public.bookings'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) like '%cancelled%' and pg_get_constraintdef(oid) like '%pending%'
  loop
    execute format('alter table public.bookings drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.bookings add constraint bookings_status_check
  check (status in ('pending', 'accepted', 'confirmed', 'active', 'completed', 'rejected', 'cancelled', 'expired'));

alter table public.bookings
  add column respond_by timestamptz,
  add column pay_by timestamptz;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'bookingRequest', 'bookingAccepted', 'bookingRejected', 'paymentConfirmed', 'pickupReminder',
  'returnConfirmed', 'reviewReceived', 'listingApproved', 'listingRejected',
  'documentApproved', 'documentRejected', 'newMessage', 'equipmentAvailable',
  'pickupWaiting', 'returnWaiting', 'bookingExpired', 'cityAvailable', 'hostDemand'));

/** Prazos (mudar aqui muda para todo o site). */
create or replace function public.respond_deadline(p_start_date date, p_start_at timestamptz)
returns timestamptz language sql stable set search_path = '' as $$
  select least(now() + case when p_start_date <= public.today_sp() then interval '20 minutes' else interval '24 hours' end,
               greatest(coalesce(p_start_at, now() + interval '24 hours'), now() + interval '20 minutes'))
$$;
create or replace function public.pay_deadline()
returns interval language sql immutable set search_path = '' as $$ select interval '10 minutes' $$;

-- Roda depois de "bookings_times" (que preenche start_at): os gatilhos seguem a ordem do nome.
create or replace function public.bookings_vencimento()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending' then new.respond_by := public.respond_deadline(new.start_date, new.start_at); end if;
    if new.status = 'accepted' then new.pay_by := now() + public.pay_deadline(); end if;
    return new;
  end if;
  -- Aceitar depois do prazo não vale (mesmo que a limpeza automática ainda não tenha rodado).
  if old.status = 'pending' and new.status in ('accepted', 'confirmed') and old.respond_by is not null and old.respond_by < now() then
    raise exception 'request_expired';
  end if;
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    new.pay_by := now() + public.pay_deadline();
  end if;
  return new;
end;
$$;
create trigger bookings_vencimento before insert or update of status on public.bookings
  for each row execute function public.bookings_vencimento();
revoke execute on function public.bookings_vencimento() from public, anon, authenticated;

-- Reservas que já estavam esperando: ganham o prazo a partir de agora.
update public.bookings set respond_by = public.respond_deadline(start_date, start_at) where status = 'pending';
update public.bookings set pay_by = now() + interval '24 hours' where status = 'accepted';

/** Vence pedidos sem resposta e aceites sem pagamento. Roda a cada minuto. */
create or replace function public.expire_bookings()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  b record;
  n integer := 0;
  eq_title text;
begin
  for b in
    select * from public.bookings x
    where (x.status = 'pending' and x.respond_by < now())
       or (x.status = 'accepted' and x.pay_by < now()
           and not exists (select 1 from public.payments p
                            where p.booking_id = x.id and p.status in ('pending', 'in_process', 'authorized', 'approved')))
    for update skip locked
  loop
    update public.bookings set status = 'expired' where id = b.id;
    select title into eq_title from public.equipment where id = b.equipment_id;
    insert into public.notifications (user_id, kind, href, title, name, needs_action)
      values (b.rider_id, 'bookingExpired', '/rider/reservations/' || b.id, eq_title, case b.status when 'pending' then 'host' else 'payment' end, false),
             (b.host_id, 'bookingExpired', '/host/reservations#' || b.id, eq_title, case b.status when 'pending' then 'host' else 'payment' end, false);
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function public.expire_bookings() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      perform cron.schedule('reservas-prazo', '* * * * *', 'select public.expire_bookings()');
    exception when others then
      raise notice 'Prazo das reservas não agendado: %', sqlerrm;
    end;
  end if;
end;
$$;
