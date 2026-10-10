\set ON_ERROR_STOP 1
-- Testes do "Avisar quando disponível". Rodam depois de todas as migrações, num banco novo.
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
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.fails($$insert into public.waitlist (equipment_id, user_id) values ('10000000-0000-0000-0000-000000000001', auth.uid())$$, '42501', 'não entra na lista de anúncio em análise');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.review_listing('10000000-0000-0000-0000-000000000001', true);

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update public.equipment set is_available = false;
select pg_temp.fails($$insert into public.waitlist (equipment_id, user_id) values ('10000000-0000-0000-0000-000000000001', auth.uid())$$, '42501', 'Host não entra na lista do próprio anúncio');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.fails($$insert into public.waitlist (equipment_id, user_id) values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c')$$, '42501', 'ninguém coloca outra pessoa na lista');
insert into public.waitlist (equipment_id, user_id) values ('10000000-0000-0000-0000-000000000001', auth.uid());
select pg_temp.ok((select count(*) from public.waitlist) = 1, 'Rider entra na lista de espera');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.ok((select count(*) from public.waitlist) = 0, 'Host não vê quem está na lista');
update public.equipment set is_available = true;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select kind = 'equipmentAvailable' and title = 'Patinete Aro 10' and href = '/equipment/10000000-0000-0000-0000-000000000001' from public.notifications), 'Rider recebe aviso quando volta a ficar disponível');
select pg_temp.ok((select count(*) from public.waitlist) = 0, 'depois do aviso, a pessoa sai da lista');
reset role;
\echo 'Aviso de disponível: todos os testes passaram'
