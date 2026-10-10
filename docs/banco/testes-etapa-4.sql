\set ON_ERROR_STOP 1
-- Testes da etapa 4 (reservas). Rodam depois de todas as migrações, num banco novo.
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

-- Pessoas: Host (a), Rider (b), outro Rider (d), equipe (c)
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a', 'rafael@exemplo.com', '{"full_name":"Rafael Santos"}'),
 ('00000000-0000-0000-0000-00000000000b', 'ana@exemplo.com', '{"full_name":"Ana Paula Lima"}'),
 ('00000000-0000-0000-0000-00000000000d', 'joao@exemplo.com', '{"full_name":"João Victor"}'),
 ('00000000-0000-0000-0000-00000000000c', 'equipe@hiscoot.com.br', '{"full_name":"Equipe Hi Scoot"}');
update public.profile_private set is_admin = true where id = '00000000-0000-0000-0000-00000000000c';

-- Anúncio aprovado do Host
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.become_host();
insert into public.equipment (id, host_id, type, title, description, daily_price, city, area, pickup_time, return_time)
  values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'scooter', 'Patinete Aro 10', 'Com capacete.', 45, 'São Paulo', 'Jardins', '09:00', '18:00');
insert into public.equipment_private (equipment_id, pickup_address, latitude, longitude) values ('10000000-0000-0000-0000-000000000001', 'Rua A, 1', -23.5649, -46.6631);
select pg_temp.fails($$insert into public.blocked_days values ('10000000-0000-0000-0000-000000000001', public.today_sp() + 20)$$, '42501', 'anúncio em análise não tem calendário');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.review_listing('10000000-0000-0000-0000-000000000001', true);

-- Host bloqueia um dia
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.blocked_days values ('10000000-0000-0000-0000-000000000001', public.today_sp() + 20);
select pg_temp.fails($$insert into public.blocked_days values ('10000000-0000-0000-0000-000000000001', public.today_sp() - 1)$$, '42501', 'Host não bloqueia dia que já passou');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.fails($$insert into public.blocked_days values ('10000000-0000-0000-0000-000000000001', public.today_sp() + 21)$$, '42501', 'Rider não bloqueia dia do anúncio dos outros');
select pg_temp.ok((select count(*) from public.unavailable_days('10000000-0000-0000-0000-000000000001') where kind = 'blocked') = 1, 'dia bloqueado aparece como bloqueado');

-- Pedido
select pg_temp.as_user(null);
select pg_temp.fails($$select public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 5, public.today_sp() + 7)$$, '42501', 'visitante não pede reserva');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.fails($$select public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 5, public.today_sp() + 7)$$, 'own_listing', 'Host não reserva o próprio anúncio');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.fails($$select public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() - 1, public.today_sp() + 1)$$, 'pickup_in_past', 'retirada no passado é recusada');
select pg_temp.fails($$select public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 5, public.today_sp() + 5)$$, 'return_before_pickup', 'devolução no mesmo dia é recusada (mínimo 1 diária)');
select pg_temp.fails($$select public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 19, public.today_sp() + 21)$$, 'dates_unavailable', 'pedido em dia bloqueado é recusado');
select pg_temp.fails($$insert into public.bookings (equipment_id, rider_id, host_id, start_date, end_date, host_daily_price, pickup_time, return_time) values ('10000000-0000-0000-0000-000000000001', auth.uid(), '00000000-0000-0000-0000-00000000000a', public.today_sp() + 5, public.today_sp() + 7, 1, '09:00', '18:00')$$, '42501', 'Rider não grava reserva direto na tabela (preço sempre do servidor)');
create temp table ids (name text primary key, id uuid);
grant all on ids to anon, authenticated;
insert into ids select 'b1', public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 5, public.today_sp() + 7);
select pg_temp.ok((select host_daily_price = 45 and status = 'pending' from public.bookings where id = (select id from ids where name = 'b1')), 'pedido guarda o preço do anúncio e fica aguardando o Host');
select pg_temp.fails($$update public.bookings set status = 'confirmed'$$, '42501', 'Rider não muda a situação da reserva direto');
select pg_temp.fails($$select public.decide_booking((select id from ids where name = 'b1'), true)$$, 'not_allowed', 'Rider não aceita o próprio pedido');
select pg_temp.ok(public.pickup_address((select id from ids where name = 'b1')) is null, 'Rider não vê o endereço antes de pagar');

-- Outro Rider pede os mesmos dias (pedido novo não bloqueia dia)
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
insert into ids select 'b2', public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 6, public.today_sp() + 8);
select pg_temp.ok((select count(*) from public.bookings) = 1, 'cada Rider só vê a própria reserva');
select pg_temp.fails($$select public.cancel_booking((select id from ids where name = 'b1'))$$, 'not_allowed', 'Rider não cancela reserva dos outros');

-- Host recebe avisos, aceita a primeira e não consegue aceitar a segunda
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.ok((select count(*) from public.notifications where kind = 'bookingRequest' and needs_action) = 2, 'Host recebe aviso de cada pedido');
select pg_temp.ok((select count(*) from public.bookings) = 2, 'Host vê os pedidos dos anúncios dele');
select pg_temp.fails($$select public.cancel_booking((select id from ids where name = 'b1'))$$, 'not_allowed', 'Host não cancela pedido novo (ele recusa)');
select pg_temp.ok(public.decide_booking((select id from ids where name = 'b1'), true) = 'accepted', 'Host aceita o pedido');
select pg_temp.fails($$select public.decide_booking((select id from ids where name = 'b2'), true)$$, 'dates_taken', 'Host não aceita pedido em dias já reservados');
select pg_temp.fails($$insert into public.blocked_days values ('10000000-0000-0000-0000-000000000001', public.today_sp() + 6)$$, 'booked', 'Host não bloqueia dia já reservado');
select pg_temp.ok((select count(*) from public.unavailable_days('10000000-0000-0000-0000-000000000001') where kind = 'booked') = 3, 'dias da reserva aceita ficam reservados (retirada até devolução)');
select pg_temp.fails($$select public.decide_booking((select id from ids where name = 'b2'), false)$$, 'reason_required', 'recusar exige motivo');
select pg_temp.fails($$select public.decide_booking((select id from ids where name = 'b2'), false, '  ok  ')$$, 'reason_required', 'motivo curto demais é recusado');
select pg_temp.fails($$update public.bookings set reject_reason = 'Outro motivo'$$, '42501', 'Host não muda o motivo direto na tabela');
select pg_temp.ok(public.decide_booking((select id from ids where name = 'b2'), false, 'Equipamento em manutenção') = 'rejected', 'Host recusa o outro pedido com motivo');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.ok((select kind from public.notifications) = 'bookingRejected', 'Rider recusado recebe aviso');
select pg_temp.ok((select reject_reason from public.bookings) = 'Equipamento em manutenção', 'Rider vê o motivo da recusa');
select pg_temp.fails($$select public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 7, public.today_sp() + 9)$$, 'dates_unavailable', 'novo pedido em dias reservados é recusado');

-- Pagamento de teste
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.fails($$select public.pay_booking_test((select id from ids where name = 'b1'))$$, 'not_allowed', 'ninguém paga a reserva dos outros');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select kind from public.notifications) = 'bookingAccepted', 'Rider recebe aviso de pedido aceito');
select public.pay_booking_test((select id from ids where name = 'b1'));
select pg_temp.ok((select status from public.bookings) = 'confirmed', 'pagamento confirma a reserva');
select pg_temp.ok(public.pickup_address((select id from ids where name = 'b1')) = 'Rua A, 1', 'Rider vê o endereço depois de pagar');
select pg_temp.fails($$select public.pay_booking_test((select id from ids where name = 'b1'))$$, 'not_allowed', 'não paga duas vezes');

-- Retirada: código da etiqueta + foto
reset role;
insert into storage.objects (bucket_id, name, owner) values
  ('handoff-photos', '00000000-0000-0000-0000-00000000000b/ret.jpg', '00000000-0000-0000-0000-00000000000b'),
  ('handoff-photos', '00000000-0000-0000-0000-00000000000a/dev.jpg', '00000000-0000-0000-0000-00000000000a');
insert into ids select 'label', null;
update ids set name = (select label_code from public.equipment_private) where name = 'label';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.fails($$select public.confirm_handoff((select id from ids where name = 'b1'), 'return', '00000000-0000-0000-0000-00000000000b/ret.jpg', 'X')$$, 'wrong_status', 'devolução antes da retirada é recusada');
select pg_temp.fails($$select public.confirm_handoff((select id from ids where name = 'b1'), 'pickup', '00000000-0000-0000-0000-00000000000b/ret.jpg', 'HS-000000')$$, 'code_invalid', 'código errado da etiqueta é recusado');
select pg_temp.fails($$select public.confirm_handoff((select id from ids where name = 'b1'), 'pickup', '00000000-0000-0000-0000-00000000000b/nao-existe.jpg', (select name from ids where name like 'HS-%'))$$, 'photo_required', 'foto que não foi enviada é recusada');
select pg_temp.fails($$select public.confirm_handoff((select id from ids where name = 'b1'), 'pickup', '00000000-0000-0000-0000-00000000000a/dev.jpg', (select name from ids where name like 'HS-%'))$$, 'photo_required', 'Rider não usa foto da pasta de outra pessoa');
select public.confirm_handoff((select id from ids where name = 'b1'), 'pickup', '00000000-0000-0000-0000-00000000000b/ret.jpg', lower((select name from ids where name like 'HS-%')));
select pg_temp.ok((select status from public.bookings) = 'active', 'retirada confirmada: reserva em uso (código aceito em minúsculas)');
select pg_temp.fails($$select public.cancel_booking((select id from ids where name = 'b1'))$$, 'not_allowed', 'reserva em uso não se cancela');

-- Devolução pelo Host, com foto
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.fails($$select public.confirm_handoff((select id from ids where name = 'b1'), 'return', null)$$, 'photo_required', 'Host precisa de foto para confirmar');
select public.confirm_handoff((select id from ids where name = 'b1'), 'return', '00000000-0000-0000-0000-00000000000a/dev.jpg');
select pg_temp.ok((select status from public.bookings where id = (select id from ids where name = 'b1')) = 'completed', 'devolução confirmada: reserva concluída');
select pg_temp.ok((select count(*) from storage.objects where name like '00000000-0000-0000-0000-00000000000b/%') = 1, 'Host vê a foto de retirada do Rider desta reserva');
select pg_temp.ok((select count(*) from public.notifications where kind = 'returnConfirmed') = 1, 'Host recebe aviso de devolução');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.ok((select count(*) from storage.objects where bucket_id = 'handoff-photos') = 0, 'outras pessoas não veem as fotos');
select pg_temp.ok((select count(*) from public.handoffs) = 0, 'outras pessoas não veem as confirmações');

-- Cancelamento: prazo de 24 h antes da retirada
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into ids select 'b3', public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 30, public.today_sp() + 31);
select public.cancel_booking((select id from ids where name = 'b3'));
select pg_temp.ok((select status = 'cancelled' and cancelled_by = 'rider' from public.bookings where id = (select id from ids where name = 'b3')), 'Rider cancela pedido novo sem custo');
insert into ids select 'b4', public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 1, public.today_sp() + 2);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.decide_booking((select id from ids where name = 'b4'), true);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.pay_booking_test((select id from ids where name = 'b4'));
reset role;
update public.bookings set start_date = public.today_sp(), end_date = public.today_sp() + 1, pickup_time = '23:59' where id = (select id from ids where name = 'b4');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.fails($$select public.cancel_booking((select id from ids where name = 'b4'))$$, 'deadline_passed', 'reserva paga não se cancela a menos de 24 h da retirada');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.fails($$select public.cancel_booking((select id from ids where name = 'b4'))$$, 'deadline_passed', 'Host também não cancela a menos de 24 h');
reset role;
update public.bookings set start_date = public.today_sp() + 3, end_date = public.today_sp() + 4 where id = (select id from ids where name = 'b4');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.cancel_booking((select id from ids where name = 'b4'));
select pg_temp.ok((select cancelled_by from public.bookings where id = (select id from ids where name = 'b4')) = 'host', 'Host cancela reserva paga antes do prazo');
select pg_temp.ok((select count(*) from public.unavailable_days('10000000-0000-0000-0000-000000000001') where kind = 'booked') = 0, 'dias de reservas canceladas e concluídas voltam a ficar livres');
delete from public.blocked_days where day = public.today_sp() + 20;
select pg_temp.ok((select count(*) from public.unavailable_days('10000000-0000-0000-0000-000000000001')) = 0, 'Host desbloqueia o dia');

-- Equipe vê tudo
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from public.bookings) = 4, 'equipe vê todas as reservas');
reset role;
\echo 'Etapa 4: todos os testes passaram'
