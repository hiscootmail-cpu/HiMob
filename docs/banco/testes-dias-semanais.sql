\set ON_ERROR_STOP 1
-- Dias que se repetem toda semana e procura por cidade (simulador). Num banco novo, depois de todas as migrações.
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
 ('00000000-0000-0000-0000-00000000000a', 'host@exemplo.com', '{"full_name":"Rafael Santos"}'),
 ('00000000-0000-0000-0000-00000000000b', 'ana@exemplo.com', '{"full_name":"Ana Paula Lima"}');
update public.profiles set identity_status = 'approved';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.become_host();
insert into public.equipment (id, host_id, type, title, description, daily_price, city, area, pickup_time, return_time)
  values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'scooter', 'Patinete', 'Ok.', 40, 'Mogi Mirim', 'Centro', '08:00', '18:00');

-- Sábado e domingo, toda semana
select public.set_weekly_days('10000000-0000-0000-0000-000000000001', '{6,0}');
select pg_temp.ok((select count(*) from public.equipment_available_days) between 24 and 28, 'Libera fins de semana dos próximos 90 dias');
select pg_temp.ok((select bool_and(extract(dow from day) in (0, 6)) from public.equipment_available_days), 'Só sábados e domingos');
select pg_temp.ok((select count(*) from public.equipment_weekly_days) = 2, 'Guarda os dias da semana');

-- Fecha um sábado avulso; a renovação diária não traz ele de volta
delete from public.equipment_available_days where day = (select min(day) from public.equipment_available_days where extract(dow from day) = 6);
select pg_temp.ok((select count(*) from public.equipment_weekly_days) = 2, 'Dia avulso fechado sem mudar a regra');

-- Troca para só domingo: sábados da janela saem
select public.set_weekly_days('10000000-0000-0000-0000-000000000001', '{0}');
select pg_temp.ok((select bool_and(extract(dow from day) = 0) from public.equipment_available_days), 'Tira os sábados ao mudar a regra');

-- Outra pessoa não mexe
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.fails($$select public.set_weekly_days('10000000-0000-0000-0000-000000000001', '{1}')$$, 'not_allowed', 'Só o dono muda os dias da semana');
select pg_temp.ok((select count(*) from public.equipment_weekly_days) = 0, 'Rider não vê os dias da semana do Host');

-- Renovação diária
reset role;
select public.set_weekly_days('10000000-0000-0000-0000-000000000001', array[extract(dow from public.today_sp() + 90)::smallint]) from (select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false)) s;
delete from public.equipment_available_days where day = public.today_sp() + 90;
select pg_temp.ok(public.extend_weekly_days() = 1, 'Todo dia libera o dia novo da janela');

-- Simulador: procura por cidade
update public.equipment set review_status = 'approved';
insert into public.rider_trips (rider_id, city, city_state, from_day, until_day, wants)
  values ('00000000-0000-0000-0000-00000000000b', 'mogi mirim', 'SP', public.today_sp() + 3, public.today_sp() + 5, '{scooter}');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select trips_90 = 1 and equipment = 1 and avg_daily = 40 from public.city_demand_summary('Mogi Mirim')), 'Simulador: viagens, equipamentos e diária média');

\echo 'Dias semanais: todos os testes passaram'
