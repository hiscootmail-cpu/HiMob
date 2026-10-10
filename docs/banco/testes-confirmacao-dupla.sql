\set ON_ERROR_STOP 1
-- Testes da confirmação dupla e da fila da equipe. Rodam depois de todas as migrações, num banco novo.
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
 ('00000000-0000-0000-0000-00000000000a', 'rafael@exemplo.com', '{"full_name":"Rafael Santos"}'),
 ('00000000-0000-0000-0000-00000000000b', 'ana@exemplo.com', '{"full_name":"Ana Paula Lima"}'),
 ('00000000-0000-0000-0000-00000000000c', 'equipe@hiscoot.com.br', '{"full_name":"Equipe Hi Scoot"}');
update public.profile_private set is_admin = true where id = '00000000-0000-0000-0000-00000000000c';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.become_host();
insert into public.equipment (id, host_id, type, title, description, daily_price, city, area, pickup_time, return_time)
  values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'scooter', 'Patinete Aro 10', 'Com capacete.', 45, 'São Paulo', 'Jardins', '09:00', '18:00');
insert into public.equipment_private (equipment_id, pickup_address, latitude, longitude) values ('10000000-0000-0000-0000-000000000001', 'Rua A, 1', -23.5649, -46.6631);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.review_listing('10000000-0000-0000-0000-000000000001', true);

create temp table ids (name text primary key, id uuid);
grant all on ids to anon, authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into ids select 'b1', public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 2, public.today_sp() + 3);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.decide_booking((select id from ids where name = 'b1'), true);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.pay_booking_test((select id from ids where name = 'b1'));
reset role;
insert into storage.objects (bucket_id, name, owner) values
  ('handoff-photos', '00000000-0000-0000-0000-00000000000a/r.jpg', '00000000-0000-0000-0000-00000000000a'),
  ('handoff-photos', '00000000-0000-0000-0000-00000000000b/d.jpg', '00000000-0000-0000-0000-00000000000b');
insert into ids select 'label', null;
update ids set name = (select label_code from public.equipment_private) where name = 'label';

-- Host confirma a retirada; o Rider não confirma
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.ok(public.confirm_handoff((select id from ids where name = 'b1'), 'pickup', '00000000-0000-0000-0000-00000000000a/r.jpg') = 'waiting', 'Host confirma a retirada e espera o Rider');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select name = 'Rafael S.' and href like '/rider/reservations/%/pickup' from public.notifications where kind = 'pickupWaiting'), 'Rider recebe aviso que leva à tela de retirada');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from public.handoff_queue()) = 0, 'antes de 2 horas, a reserva não vai para a fila da equipe');
reset role;
update public.handoffs set created_at = now() - interval '3 hours';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.ok((select kind = 'pickup' and confirmed_by = 'host' and rider_name = 'Ana L.' and host_name = 'Rafael S.' from public.handoff_queue()), 'depois de 2 horas, a reserva entra na fila da equipe');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.handoff_queue()) = 0, 'só a equipe vê a fila');
select pg_temp.fails($$select public.admin_confirm_handoff((select id from ids where name = 'b1'), 'pickup', 'Confirmado por telefone com as duas pessoas.')$$, 'not_allowed', 'só a equipe confirma pela plataforma');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.fails($$select public.admin_confirm_handoff((select id from ids where name = 'b1'), 'pickup', 'curto')$$, 'reason_required', 'confirmar pela plataforma exige motivo de 10+ letras');
select pg_temp.fails($$select public.admin_confirm_handoff((select id from ids where name = 'b1'), 'return', 'Confirmado por telefone com as duas pessoas.')$$, 'not_allowed', 'não confirma devolução antes da retirada');
select public.admin_confirm_handoff((select id from ids where name = 'b1'), 'pickup', 'Confirmado por telefone com as duas pessoas.');
select pg_temp.ok((select status from public.bookings) = 'active', 'equipe confirmou: reserva em uso');
select pg_temp.ok((select count(*) from public.handoff_queue()) = 0, 'reserva resolvida sai da fila');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select reason from public.handoff_resolutions) = 'Confirmado por telefone com as duas pessoas.', 'Rider vê o motivo da equipe');
select pg_temp.fails($$insert into public.handoff_resolutions (booking_id, kind, admin_id, reason) values ((select id from ids where name = 'b1'), 'return', auth.uid(), 'Eu mesmo confirmo isto aqui.')$$, '42501', 'ninguém grava decisão da equipe direto na tabela');

-- Devolução: o Rider confirma, o Host não; a equipe confirma e as avaliações abrem
select pg_temp.ok(public.confirm_handoff((select id from ids where name = 'b1'), 'return', '00000000-0000-0000-0000-00000000000b/d.jpg', (select name from ids where name like 'HS-%')) = 'waiting', 'Rider confirma a devolução e espera o Host');
reset role;
update public.handoffs set created_at = now() - interval '3 hours' where kind = 'return';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.ok((select confirmed_by = 'rider' and kind = 'return' from public.handoff_queue()), 'devolução sem o Host vai para a fila');
select public.admin_confirm_handoff((select id from ids where name = 'b1'), 'return', 'Host confirmou a devolução por telefone.');
select pg_temp.ok((select status from public.bookings) = 'completed', 'equipe confirmou: reserva concluída');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.notifications where kind = 'returnConfirmed') = 1, 'Rider recebe aviso para avaliar');
select public.submit_review((select id from ids where name = 'b1'), 5, 5, '');
select pg_temp.ok((select rider_reviewed from public.bookings), 'Rider avalia depois da devolução confirmada pela equipe');
reset role;
\echo 'Confirmação dupla: todos os testes passaram'
