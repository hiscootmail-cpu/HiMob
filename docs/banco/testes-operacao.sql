\set ON_ERROR_STOP 1
-- Painel → Operação: números da operação, só para a equipe. Num banco novo, depois de todas as migrações.
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
 ('00000000-0000-0000-0000-00000000000a', 'host@exemplo.com', '{"full_name":"Host Mogi"}'),
 ('00000000-0000-0000-0000-00000000000b', 'rider@exemplo.com', '{"full_name":"Rider Sampa"}'),
 ('00000000-0000-0000-0000-00000000000d', 'saiu@exemplo.com', '{"full_name":"Conta Excluída"}'),
 ('00000000-0000-0000-0000-00000000000c', 'equipe@hiscoot.com.br', '{"full_name":"Equipe Hi Scoot"}');
update public.profile_private set is_admin = true where id = '00000000-0000-0000-0000-00000000000c';
update public.profiles set city = 'Mogi Mirim', identity_status = 'approved', is_host = true where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set city = 'São Paulo', identity_status = 'approved' where id = '00000000-0000-0000-0000-00000000000b';
update public.profiles set city = 'Mogi Mirim', deleted_at = now() where id = '00000000-0000-0000-0000-00000000000d';

insert into public.equipment (id, host_id, type, title, description, daily_price, city, area, pickup_time, return_time, review_status) values
 ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'scooter', 'Patinete 1', 'Ok.', 45, 'Mogi Mirim', 'Centro', '08:00', '20:00', 'approved'),
 ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'scooter', 'Patinete 2', 'Ok.', 45, 'mogi mirim ', 'Centro', '08:00', '20:00', 'approved'),
 ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', 'ebike', 'Bike 1', 'Ok.', 60, 'São Paulo', 'Sé', '08:00', '20:00', 'approved'),
 ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000a', 'ebike', 'Bike em análise', 'Ok.', 60, 'São Paulo', 'Sé', '08:00', '20:00', 'pending');
insert into public.equipment_available_days (equipment_id, day) values
 ('10000000-0000-0000-0000-000000000001', public.today_sp()), ('10000000-0000-0000-0000-000000000002', public.today_sp() - 3);
insert into public.bookings (equipment_id, rider_id, host_id, start_date, end_date, host_daily_price, pickup_time, return_time, status) values
 ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a', public.today_sp(), public.today_sp(), 45, '09:00', '10:00', 'active');

-- Só a equipe vê os números
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.fails($$select public.admin_operations()$$, 'not_allowed', 'Rider não vê a operação');
select pg_temp.as_user(null);
select pg_temp.fails($$select public.admin_operations()$$, '42501', 'Visitante não vê a operação');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
create temp table r as select public.admin_operations() as all_, public.admin_operations(' Mogi Mirim') as mogi;
select pg_temp.ok((all_ ->> 'riders')::int = 3 and (all_ ->> 'riders_verified')::int = 2, 'Riders: cadastrados e aprovados (sem conta excluída)') from r;
select pg_temp.ok((all_ ->> 'hosts')::int = 1, 'Hosts: com anúncio publicado') from r;
select pg_temp.ok((all_ #>> '{equipment,scooter,published}')::int = 2 and (all_ #>> '{equipment,ebike,published}')::int = 1, 'Publicados por tipo (em análise não conta)') from r;
select pg_temp.ok((all_ #>> '{equipment,scooter,with_days}')::int = 1, 'Com dias liberados só de hoje em diante') from r;
select pg_temp.ok((all_ #>> '{equipment,scooter,in_use}')::int = 1 and (all_ #>> '{equipment,ebike,in_use}')::int = 0, 'Em uso agora por tipo') from r;
select pg_temp.ok((all_ ->> 'pickups_today')::int = 1, 'Retiradas de hoje') from r;
select pg_temp.ok((all_ ->> 'queue_listings')::int = 1, 'Fila de anúncios') from r;
select pg_temp.ok((mogi ->> 'riders')::int = 1 and (mogi #>> '{equipment,scooter,published}')::int = 2 and (mogi #>> '{equipment,ebike,published}')::int = 0, 'Filtro por cidade') from r;


-- Regiões: cidade → estado e país (o site preenche; aqui a equipe grava direto)
select pg_temp.ok((select count(*) from public.admin_places()) = 2, 'Cidades com anúncio, sem repetir');
select pg_temp.ok((select count(*) from public.admin_places() where country is null) = 2, 'Cidades ainda sem região');
insert into public.city_regions (city_key, city, state, state_code, country) values
  (public.city_key('Mogi Mirim'), 'Mogi Mirim', 'São Paulo', 'SP', 'BR'),
  (public.city_key('São Paulo'), 'São Paulo', 'São Paulo', 'SP', 'BR');
select pg_temp.ok((select count(*) from public.admin_places() where state_code = 'SP') = 2, 'Região guardada aparece');
select pg_temp.ok((public.admin_operations(p_state => 'são paulo') #>> '{equipment,scooter,published}')::int = 2
  and (public.admin_operations(p_state => 'São Paulo') #>> '{equipment,ebike,published}')::int = 1, 'Filtro por estado');
select pg_temp.ok((public.admin_operations(p_country => 'br') ->> 'riders')::int = 2, 'Filtro por país conta Riders das cidades da região');
select pg_temp.ok((public.admin_operations(p_country => 'PT') ->> 'hosts')::int = 0, 'País sem operação fica zerado');
select pg_temp.ok((public.admin_operations(p_country => 'BR') ->> 'pickups_today')::int = 1, 'Retiradas de hoje no país');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.admin_places()) = 0, 'Rider não vê as cidades');
select pg_temp.fails($$insert into public.city_regions (city_key, city, country) values ('x', 'X', 'BR')$$, '42501', 'Rider não grava região');

\echo 'Operação: todos os testes passaram'
