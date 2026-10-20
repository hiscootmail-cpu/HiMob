\set ON_ERROR_STOP 1
-- Dias disponíveis e aluguel por horas. Num banco novo, depois de todas as migrações.
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
 ('00000000-0000-0000-0000-00000000000b', 'ana@exemplo.com', '{"full_name":"Ana Paula Lima","phone":"11955550102"}'),
 ('00000000-0000-0000-0000-00000000000d', 'bia@exemplo.com', '{"full_name":"Bia Souza","phone":"11955550103"}');
update public.profiles set identity_status = 'approved';
create temp table ids (name text, id uuid);
grant all on ids to authenticated;

-- Preço: diária 45, atendimento das 10h às 17h (7 horas)
select pg_temp.ok(public.rental_host_amount(45, '10:00', '17:00', '2026-11-10 10:00-03', '2026-11-10 13:00-03') = 19.29, 'Preço: 3 horas = 3 x 45/7');
select pg_temp.ok(public.rental_host_amount(45, '10:00', '17:00', '2026-11-10 10:00-03', '2026-11-10 17:00-03') = 45, 'Preço: o dia todo = 1 diária');
select pg_temp.ok(public.rental_host_amount(45, '10:00', '17:00', '2026-11-10 10:00-03', '2026-11-10 22:00-03') = 45, 'Preço: até 24 h nunca passa de 1 diária');
select pg_temp.ok(public.rental_host_amount(45, '10:00', '17:00', '2026-11-10 10:00-03', '2026-11-11 12:00-03') = 57.86, 'Preço: 26 h = 1 diária + 2 horas');
select pg_temp.ok(public.rental_host_amount(45, '00:00', '00:00', '2026-11-10 10:00-03', '2026-11-10 22:00-03') = 22.5, 'Preço: atendimento 24 h, 12 horas = meia diária');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.become_host();
insert into public.equipment (id, host_id, type, title, description, daily_price, city, area, pickup_time, return_time)
  values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'scooter', 'Patinete', 'Ok.', 45, 'Mogi Mirim', 'Centro', '10:00', '17:00');
reset role;
update public.equipment set review_status = 'approved';

-- Sem dias liberados, ninguém reserva
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.fails($$select public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 3, '10:00', public.today_sp() + 3, '13:00')$$, 'dates_unavailable', 'Sem dia liberado pelo Host: não reserva');
select pg_temp.fails($$insert into public.equipment_available_days values ('10000000-0000-0000-0000-000000000001', public.today_sp() + 3)$$, '42501', 'Rider não libera dia');

-- O Host libera os dias
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.equipment_available_days select '10000000-0000-0000-0000-000000000001', public.today_sp() + n from generate_series(3, 5) n;
select pg_temp.fails($$insert into public.equipment_available_days values ('10000000-0000-0000-0000-000000000001', public.today_sp() - 1)$$, '42501', 'Host não libera dia no passado');

-- Visitante vê o calendário
select pg_temp.as_user(null);
select pg_temp.ok((select count(*) from public.equipment_schedule('10000000-0000-0000-0000-000000000001') where kind = 'available') = 3, 'Visitante vê os 3 dias liberados');

-- Regras de horário
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.fails($$select public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 3, '10:15', public.today_sp() + 3, '13:00')$$, 'time_invalid', 'Horário de 30 em 30 minutos');
select pg_temp.fails($$select public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 3, '09:00', public.today_sp() + 3, '13:00')$$, 'outside_hours', 'Fora do atendimento do Host');
select pg_temp.fails($$select public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 3, '10:00', public.today_sp() + 3, '10:30')$$, 'too_short', 'Mínimo de 1 hora');
select pg_temp.fails($$select public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 5, '10:00', public.today_sp() + 6, '13:00')$$, 'dates_unavailable', 'Todos os dias precisam estar liberados');
insert into ids select 'a', public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 3, '10:00', public.today_sp() + 3, '13:00');
select pg_temp.ok((select host_amount from public.bookings where id = (select id from ids where name = 'a')) = 19.29, 'Reserva de 3 horas guarda o valor por hora');

-- Duas pessoas no mesmo dia, com 1 hora de intervalo
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
insert into ids select 'b', public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 3, '14:00', public.today_sp() + 3, '16:00');
insert into ids select 'c', public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 3, '13:30', public.today_sp() + 3, '15:00');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.decide_booking((select id from ids where name = 'a'), true);
select public.decide_booking((select id from ids where name = 'b'), true);
select pg_temp.ok((select count(*) from public.bookings where status = 'accepted') = 2, 'Duas reservas aceitas no mesmo dia (10h-13h e 14h-16h)');
select pg_temp.fails($$select public.decide_booking((select id from ids where name = 'c'), true)$$, 'dates_taken', 'Sem 1 hora de intervalo: Host não aceita');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.fails($$select public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 3, '16:30', public.today_sp() + 3, '17:00')$$, null, 'Novo pedido sem intervalo (ou curto demais) é recusado');
select pg_temp.fails($$select public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 3, '12:00', public.today_sp() + 3, '14:00')$$, 'times_taken', 'Horário já reservado: recusado');
select pg_temp.ok((select count(*) from public.equipment_schedule('10000000-0000-0000-0000-000000000001') where kind = 'busy') = 2, 'Calendário mostra os horários ocupados');

-- Dia com reserva aceita não pode deixar de estar disponível
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.fails($$delete from public.equipment_available_days where day = public.today_sp() + 3$$, 'day_booked', 'Host não tira dia com reserva aceita');
delete from public.equipment_available_days where day = public.today_sp() + 5;
select pg_temp.ok((select count(*) from public.equipment_available_days) = 2, 'Host tira dia livre');
reset role;
\echo 'Horários: todos os testes passaram'
