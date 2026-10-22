\set ON_ERROR_STOP 1
-- Prazos: Host responde em 20 min (mesmo dia) ou 24 h; Rider paga em 10 min; depois vence. Num banco novo, depois de todas as migrações.
set client_min_messages = warning;
create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$
begin
  if u is null then perform set_config('role', 'anon', false); perform set_config('request.jwt.claim.sub', '', false);
  else perform set_config('role', 'authenticated', false); perform set_config('request.jwt.claim.sub', u, false); end if;
end $$;
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FALHOU: %', msg; end if; raise notice 'OK  %', msg; end $$;
create or replace function pg_temp.fails(sql text, expected text, msg text) returns void language plpgsql as $$
begin execute sql; raise exception 'FALHOU: % (não deu erro)', msg;
exception when others then
  if sqlerrm like 'FALHOU%' then raise; end if;
  if expected is not null and sqlerrm <> expected and sqlstate <> expected then raise exception 'FALHOU: % (erro %: %)', msg, sqlstate, sqlerrm; end if;
  raise notice 'OK  %', msg;
end $$;
set client_min_messages = notice;

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a', 'host@exemplo.com', '{"full_name":"Rafael Santos","phone":"11955550101"}'),
 ('00000000-0000-0000-0000-00000000000b', 'ana@exemplo.com', '{"full_name":"Ana Paula Lima","phone":"11955550102"}');
update public.profiles set identity_status = 'approved';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.become_host();
insert into public.equipment (id, host_id, type, title, description, daily_price, city, area, pickup_time, return_time)
  values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'scooter', 'Patinete', 'Ok.', 45, 'Mogi Mirim', 'Centro', '00:00', '00:00');
insert into public.equipment_available_days select '10000000-0000-0000-0000-000000000001', public.today_sp() + n from generate_series(0, 10) n;
reset role;
update public.equipment set review_status = 'approved';
-- Mercado Pago não é exigido neste teste.
create or replace function public.mp_required() returns boolean language sql as $$ select false $$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
create temp table ids (name text, id uuid);
insert into ids values ('agendada', public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 5, '10:00', public.today_sp() + 5, '12:00'));
insert into ids values ('outra', public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 7, '10:00', public.today_sp() + 7, '12:00'));
reset role;
select pg_temp.ok((select respond_by between now() + interval '23 hours 59 minutes' and now() + interval '24 hours 1 minute' from public.bookings where id = (select id from ids where name = 'agendada')), 'Agendada: Host tem 24 horas');
-- Pedido para hoje (inserido direto)
insert into public.bookings (id, equipment_id, rider_id, host_id, start_date, end_date, host_daily_price, pickup_time, return_time, start_at, end_at)
  values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a',
          public.today_sp(), public.today_sp() + 1, 45, '23:30', '23:30', null, null);
select pg_temp.ok((select respond_by between now() + interval '19 minutes' and now() + interval '21 minutes' from public.bookings where id = '20000000-0000-0000-0000-000000000001'), 'Mesmo dia: Host tem 20 minutos');

-- Host aceita: Rider tem 10 minutos para pagar
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.decide_booking((select id from ids where name = 'agendada'), true);
reset role;
select pg_temp.ok((select status = 'accepted' and pay_by between now() + interval '9 minutes' and now() + interval '11 minutes' from public.bookings where id = (select id from ids where name = 'agendada')), 'Aceite: 10 minutos para pagar');

-- Prazos vencidos
update public.bookings set respond_by = now() - interval '1 minute' where id = (select id from ids where name = 'outra');
update public.bookings set pay_by = now() - interval '1 minute' where id = (select id from ids where name = 'agendada');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.fails($$select public.decide_booking((select id from ids where name = 'outra'), true)$$, 'request_expired', 'Host não aceita depois do prazo');
reset role;
select pg_temp.ok(public.expire_bookings() = 2, 'Limpeza vence o pedido sem resposta e o aceite sem pagamento');
select pg_temp.ok((select count(*) from public.bookings where status = 'expired') = 2, 'Duas reservas vencidas');
select pg_temp.ok((select count(*) from public.notifications where kind = 'bookingExpired') = 4, 'Rider e Host avisados');
select pg_temp.ok((select status from public.bookings where id = '20000000-0000-0000-0000-000000000001') = 'pending', 'Pedido no prazo continua esperando');

-- Pagamento em andamento não vence
update public.bookings set status = 'accepted' where id = '20000000-0000-0000-0000-000000000001';
update public.bookings set pay_by = now() - interval '1 minute' where id = '20000000-0000-0000-0000-000000000001';
insert into public.payments (booking_id, method, status, amount, application_fee) values ('20000000-0000-0000-0000-000000000001', 'card', 'in_process', 51.75, 6.75);
select pg_temp.ok(public.expire_bookings() = 0 and (select status from public.bookings where id = '20000000-0000-0000-0000-000000000001') = 'accepted', 'Pagamento em andamento segura a reserva');

-- Vencida libera o horário: pede de novo no mesmo horário
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok(public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 5, '10:00', public.today_sp() + 5, '12:00') is not null, 'Pede de novo o mesmo horário');

\echo 'Prazos: todos os testes passaram'
