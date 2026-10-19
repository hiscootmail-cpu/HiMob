\set ON_ERROR_STOP 1
-- Testes do Mercado Pago (contas conectadas, pagamentos, cancelamento com devolução). Depois de todas as migrações, num banco novo.
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

create or replace function pg_temp.as_server() returns void language plpgsql as $$
begin perform set_config('role', 'service_role', false); perform set_config('request.jwt.claim.sub', '', false); end $$;

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a', 'rafael@exemplo.com', '{"full_name":"Rafael Santos","phone":"11955550101"}'),
 ('00000000-0000-0000-0000-00000000000b', 'ana@exemplo.com', '{"full_name":"Ana Paula Lima","phone":"11955550102"}'),
 ('00000000-0000-0000-0000-00000000000c', 'equipe@hiscoot.com.br', '{"full_name":"Equipe Hi Scoot"}');
update public.profile_private set is_admin = true where id = '00000000-0000-0000-0000-00000000000c';
-- Pessoas de teste já com a identidade verificada (só aluga e anuncia quem foi aprovado).
update public.profiles set identity_status = 'approved';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.become_host();
insert into public.equipment (id, host_id, type, title, description, daily_price, city, area, pickup_time, return_time)
  values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'scooter', 'Patinete Aro 10', 'Com capacete.', 45, 'São Paulo', 'Jardins', '09:00', '18:00');
insert into public.equipment_private (equipment_id, pickup_address, latitude, longitude) values ('10000000-0000-0000-0000-000000000001', 'Rua A, 1', -23.5649, -46.6631);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.review_listing('10000000-0000-0000-0000-000000000001', true);
create temp table ids (name text primary key, id uuid);
grant all on ids to anon, authenticated, service_role;

-- Mercado Pago ainda desligado: tudo como antes
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok(not public.mp_required(), 'Mercado Pago começa desligado');
insert into ids select 'b0', public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 40, public.today_sp() + 41);
select pg_temp.ok((select count(*) from ids where name = 'b0') = 1, 'desligado: pede reserva sem conta conectada');
select pg_temp.fails($$select * from public.app_settings$$, '42501', 'ninguém lê as chaves de funcionamento');
select pg_temp.fails($$update public.app_settings set value = 'off'$$, '42501', 'ninguém muda as chaves de funcionamento');

-- Liga o Mercado Pago (feito pela equipe no painel da Supabase)
reset role;
update public.app_settings set value = 'on' where key = 'mercado_pago';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
-- Quem só paga não precisa de conta Mercado Pago (PIX ou cartão de qualquer banco; decisão de 20/10/2026)
insert into ids select 'b1', public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 5, public.today_sp() + 6);
select pg_temp.ok((select count(*) from ids where name = 'b1') = 1, 'ligado: Rider sem conta Mercado Pago pede reserva');
select pg_temp.fails($$select * from public.mp_accounts$$, '42501', 'ninguém lê as chaves das contas Mercado Pago');
select pg_temp.fails($$insert into public.mp_accounts (user_id, mp_user_id, access_token, refresh_token, expires_at) values (auth.uid(), '1', 'x', 'y', now())$$, '42501', 'ninguém grava conta Mercado Pago direto');

-- O servidor guarda a conexão (depois do OAuth)
select pg_temp.as_server();
insert into public.mp_accounts (user_id, mp_user_id, access_token, refresh_token, expires_at) values
  ('00000000-0000-0000-0000-00000000000b', '2001', 'TEST-rider', 'R-rider', now() + interval '180 days');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok(public.mp_connected(), 'Rider aparece como conectado');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.ok(not public.mp_connected(), 'Host ainda não conectado');
select pg_temp.fails($$select public.decide_booking((select id from ids where name = 'b1'), true)$$, 'mp_not_connected', 'Host sem conta conectada não aceita pedido');
select pg_temp.as_server();
insert into public.mp_accounts (user_id, mp_user_id, access_token, refresh_token, expires_at) values
  ('00000000-0000-0000-0000-00000000000a', '1001', 'TEST-host', 'R-host', now() + interval '180 days');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.decide_booking((select id from ids where name = 'b1'), true);

-- Pagamento
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.fails($$select public.pay_booking_test((select id from ids where name = 'b1'))$$, 'not_allowed', 'ligado: pagamento de teste não existe mais');
select pg_temp.fails($$insert into public.payments (booking_id, method, amount, application_fee) values ((select id from ids where name = 'b1'), 'pix', 1, 0)$$, '42501', 'Rider não grava pagamento direto');
select pg_temp.fails($$select public.confirm_payment(gen_random_uuid())$$, '42501', 'Rider não confirma pagamento');
select pg_temp.as_server();
insert into public.payments (booking_id, mp_payment_id, method, amount, application_fee, pix_code)
  values ((select id from ids where name = 'b1'), '9001', 'pix', 103.50, 9.38, '000201...');
insert into ids select 'p1', id from public.payments where mp_payment_id = '9001';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select pix_code from public.payments) = '000201...', 'Rider vê o código PIX do próprio pagamento');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from public.payments) = 1, 'equipe vê os pagamentos');
select pg_temp.as_server();
select pg_temp.ok(public.confirm_payment((select id from ids where name = 'p1')), 'servidor confirma o pagamento aprovado');
select pg_temp.ok(not public.confirm_payment((select id from ids where name = 'p1')), 'aviso repetido do Mercado Pago não muda nada');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select status from public.bookings where id = (select id from ids where name = 'b1')) = 'confirmed', 'reserva paga');
select pg_temp.ok((select pix_code is null and status = 'approved' from public.payments), 'código PIX some depois de pago');
select pg_temp.ok((select count(*) from public.notifications where kind = 'paymentConfirmed') = 1, 'Rider recebe aviso de pagamento confirmado');

-- Cancelamento de reserva paga: só com devolução pelo servidor
select pg_temp.fails($$select public.cancel_booking((select id from ids where name = 'b1'))$$, 'refund_required', 'reserva paga não se cancela sem devolver o dinheiro');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.ok(public.cancel_check((select id from ids where name = 'b1')) = 'host', 'servidor confere que o Host pode cancelar');
select pg_temp.fails($$select public.cancel_paid_booking((select id from ids where name = 'b1'), 'host', 103.50, 13.50)$$, '42501', 'Host não registra o cancelamento pago sozinho');
select pg_temp.as_server();
select public.cancel_paid_booking((select id from ids where name = 'b1'), 'host', 103.50, 13.50);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.ok((select status = 'cancelled' and cancelled_by = 'host' from public.bookings where id = (select id from ids where name = 'b1')), 'Host cancelou a reserva paga');
select pg_temp.ok((select amount from public.host_fee_debts) = 13.50, 'Host vê a taxa pendente do cancelamento');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select refunded from public.payments) = 103.50, 'devolução registrada no pagamento');
select pg_temp.ok((select count(*) from public.host_fee_debts) = 0, 'Rider não vê taxas do Host');

-- Próxima reserva paga do Host quita a taxa
insert into ids select 'b2', public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 10, public.today_sp() + 11);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.decide_booking((select id from ids where name = 'b2'), true);
select pg_temp.as_server();
select pg_temp.ok(public.host_pending_debt('00000000-0000-0000-0000-00000000000a') = 13.50, 'servidor soma a taxa pendente do Host');
insert into public.payments (booking_id, mp_payment_id, method, amount, application_fee, debt_included)
  values ((select id from ids where name = 'b2'), '9002', 'card', 103.50, 22.88, 13.50);
select public.confirm_payment((select id from public.payments where mp_payment_id = '9002'));
select pg_temp.ok(public.host_pending_debt('00000000-0000-0000-0000-00000000000a') = 0, 'taxa pendente quitada no pagamento seguinte');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.fails($$select public.host_pending_debt(auth.uid())$$, '42501', 'só o servidor usa a soma das taxas');
reset role;
\echo 'Mercado Pago: todos os testes passaram'
