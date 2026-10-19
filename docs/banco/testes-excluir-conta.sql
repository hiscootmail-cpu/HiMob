\set ON_ERROR_STOP 1
-- Testes de "Excluir minha conta". Depois de todas as migrações, num banco novo.
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

-- Reserva em andamento impede a exclusão
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into ids select 'b1', public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 5, public.today_sp() + 6);
select pg_temp.fails($$select public.delete_my_account()$$, 'ongoing_bookings', 'Rider com reserva em andamento não exclui a conta');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.fails($$select public.delete_my_account()$$, 'ongoing_bookings', 'Host com pedido em andamento não exclui a conta');
select public.decide_booking((select id from ids where name = 'b1'), false, 'Equipamento em manutenção');
select pg_temp.fails($$update public.profiles set deleted_at = now() where id = auth.uid()$$, '42501', 'ninguém marca a exclusão direto na tabela');

-- Host exclui a conta
select pg_temp.ok(not public.account_deleted(), 'conta ativa');
select public.delete_my_account();
select pg_temp.ok(public.account_deleted(), 'conta marcada como excluída');
select pg_temp.fails($$select public.delete_my_account()$$, 'not_allowed', 'não exclui duas vezes');

select pg_temp.as_user(null);
select pg_temp.ok((select count(*) from public.listings()) = 0, 'anúncios de quem excluiu saem da busca');
select pg_temp.ok((select count(*) from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 0, 'perfil de quem excluiu não aparece para visitantes');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 0, 'nem para outras pessoas');
select pg_temp.fails($$select public.start_conversation('10000000-0000-0000-0000-000000000001')$$, 'not_allowed', 'não começa conversa com quem excluiu a conta');
select pg_temp.fails($$select public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 8, public.today_sp() + 9)$$, 'unavailable', 'não reserva equipamento de quem excluiu a conta');

-- Os dados ficam guardados (só a equipe vê, para pedidos da Justiça)
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from public.profiles where id = '00000000-0000-0000-0000-00000000000a' and deleted_at is not null) = 1, 'equipe ainda encontra o perfil excluído');
select pg_temp.ok((select full_name from public.profile_private where id = '00000000-0000-0000-0000-00000000000a') = 'Rafael Santos', 'dados privados continuam guardados');
select pg_temp.ok((select count(*) from public.bookings) = 1, 'reservas antigas continuam guardadas');
reset role;
\echo 'Excluir conta: todos os testes passaram'
