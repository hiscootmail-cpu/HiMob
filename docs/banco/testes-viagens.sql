\set ON_ERROR_STOP 1
-- Viagens do Rider (várias, sem cruzar datas) e demanda no Painel → Operação. Num banco novo, depois de todas as migrações.
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
 ('00000000-0000-0000-0000-00000000000a', 'ana@exemplo.com', '{"full_name":"Ana Souza","city":"Mogi Mirim","city_state":"SP"}'),
 ('00000000-0000-0000-0000-00000000000b', 'bia@exemplo.com', '{"full_name":"Bia Lima"}'),
 ('00000000-0000-0000-0000-00000000000c', 'equipe@hiscoot.com.br', '{"full_name":"Equipe Hi Scoot"}');
update public.profile_private set is_admin = true where id = '00000000-0000-0000-0000-00000000000c';
insert into public.equipment (host_id, type, title, description, daily_price, city, area, pickup_time, return_time, review_status) values
 ('00000000-0000-0000-0000-00000000000c', 'scooter', 'Patinete', 'Ok.', 45, 'Ubatuba', 'Centro', '08:00', '20:00', 'approved');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.rider_trips (rider_id, city, city_state, from_day, until_day, wants) values
  (auth.uid(), 'Ubatuba', 'SP', public.today_sp() + 2, public.today_sp() + 5, '{scooter}'),
  (auth.uid(), 'Rio de Janeiro', 'RJ', public.today_sp() + 20, public.today_sp() + 25, '{scooter,ebike}');
select pg_temp.ok((select count(*) from public.rider_trips) = 2, 'Pessoa marca várias viagens');
select pg_temp.fails($$insert into public.rider_trips (rider_id, city, city_state, from_day, until_day, wants) values (auth.uid(), 'Santos', 'SP', public.today_sp() + 4, public.today_sp() + 8, '{ebike}')$$, '23P01', 'Viagens não se cruzam');
select pg_temp.fails($$insert into public.rider_trips (rider_id, city, city_state, from_day, until_day, wants) values (auth.uid(), 'Santos', 'SP', public.today_sp() - 5, public.today_sp() - 1, '{ebike}')$$, '42501', 'Viagem que já acabou não entra');
select pg_temp.fails($$insert into public.rider_trips (rider_id, city, city_state, from_day, until_day, wants) values (auth.uid(), 'Santos', 'SP', public.today_sp() + 9, public.today_sp() + 8, '{ebike}')$$, '23514', 'Volta antes da ida não vale');
select pg_temp.fails($$insert into public.rider_trips (rider_id, city, city_state, from_day, until_day, wants) values ('00000000-0000-0000-0000-00000000000b', 'Santos', 'SP', public.today_sp() + 40, public.today_sp() + 41, '{ebike}')$$, '42501', 'Ninguém marca viagem para outra pessoa');
update public.rider_trips set wants = '{ebike,jetboard}' where city = 'Ubatuba';
select pg_temp.ok((select wants from public.rider_trips where city = 'Ubatuba') = '{ebike,jetboard}', 'Pessoa muda a própria viagem (vários tipos)');
select pg_temp.fails($$update public.rider_trips set wants = '{}' where city = 'Ubatuba'$$, '23514', 'Viagem precisa de pelo menos um tipo');
select pg_temp.fails($$update public.rider_trips set wants = '{barco}' where city = 'Ubatuba'$$, '23514', 'Só tipos conhecidos');
select pg_temp.fails($$select public.admin_trip_demand()$$, 'not_allowed', 'Rider não vê a demanda');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.rider_trips) = 0, 'Ninguém vê viagens de outra pessoa');
delete from public.rider_trips;
insert into public.rider_trips (rider_id, city, city_state, from_day, until_day, wants) values
  (auth.uid(), 'ubatuba ', 'SP', public.today_sp(), public.today_sp() + 1, '{scooter,ebike}');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
create temp table d as select * from public.admin_trip_demand();
select pg_temp.ok((select next7 = 2 and next30 = 2 and next90 = 2 and wants_ebike = 2 and wants_scooter = 1 and wants_jetboard = 1 and equipment = 1 from d where city_state = 'SP'), 'Demanda de Ubatuba: 2 viagens, o que pretendem usar e equipamentos lá');
select pg_temp.ok((select next7 = 0 and next30 = 1 and wants_scooter = 1 and wants_ebike = 1 and equipment = 0 from d where city = 'Rio de Janeiro'), 'Demanda do Rio: chega no mês');
select pg_temp.ok((select count(*) from public.admin_trip_demand(p_state => 'Rio de Janeiro')) = 1, 'Filtro por estado');
select pg_temp.ok((select count(*) from public.admin_trip_demand(p_city => 'Ubatuba')) = 1, 'Filtro por cidade');
reset role;
select pg_temp.ok((select state_code = 'RJ' from public.city_regions where city_key = public.city_key('Rio de Janeiro')), 'Cidade da viagem entra nas regiões');

\echo 'Viagens: todos os testes passaram'
