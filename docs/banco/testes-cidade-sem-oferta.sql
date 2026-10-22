\set ON_ERROR_STOP 1
-- Cidade sem oferta: avisar quando tiver e aviso de demanda por Hosts. Num banco novo, depois de todas as migrações.
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
 ('00000000-0000-0000-0000-00000000000b', 'ana@exemplo.com', '{"full_name":"Ana Paula Lima"}'),
 ('00000000-0000-0000-0000-00000000000d', 'bia@exemplo.com', '{"full_name":"Bia Souza"}');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok(public.request_city_alert('Ubatuba', 'sp') = 'saved', 'Rider pede aviso em cidade sem oferta');
select pg_temp.ok((select count(*) from public.city_alerts) = 1, 'Pedido guardado');
select pg_temp.fails($$select public.request_city_alert('Ubatuba', 'XX')$$, 'city_invalid', 'Estado inválido não vale');
select pg_temp.fails($$insert into public.city_alerts (user_id, city_key, city, city_state) values (auth.uid(), 'x', 'X', 'SP')$$, '42501', 'Só pela função');
reset role;
select pg_temp.ok((select count(*) from public.notifications where kind = 'hostDemand' and name = 'Ubatuba - SP') = 3, 'Todos os cadastrados recebem "Demanda por Hosts"');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.request_city_alert('ubatuba', 'SP');
reset role;
select pg_temp.ok((select count(*) from public.notifications where kind = 'hostDemand') = 3, 'Mesma cidade na mesma semana: sem aviso repetido');

-- Anúncio publicado na cidade: quem pediu é avisado uma vez
insert into public.equipment (id, host_id, type, title, description, daily_price, city, area, pickup_time, return_time)
  values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'scooter', 'Patinete Ubatuba', 'Ok.', 45, 'Ubatuba', 'Centro', '08:00', '18:00');
select pg_temp.ok((select count(*) from public.notifications where kind = 'cityAvailable') = 0, 'Em análise: ninguém é avisado ainda');
update public.equipment set review_status = 'approved';
select pg_temp.ok((select count(*) from public.notifications where kind = 'cityAvailable' and title = 'Patinete Ubatuba') = 2, 'Publicado: as 2 pessoas que pediram são avisadas');
select pg_temp.ok((select count(*) from public.city_alerts where notified_at is null) = 0, 'Aviso marcado como enviado');
update public.equipment set is_available = false;
update public.equipment set is_available = true;
select pg_temp.ok((select count(*) from public.notifications where kind = 'cityAvailable') = 2, 'Não avisa de novo');

-- Cidade com oferta: não dispara "Demanda por Hosts"
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
delete from public.city_alerts;
reset role;
delete from public.host_demand_broadcasts;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.request_city_alert('Ubatuba', 'SP');
reset role;
select pg_temp.ok((select count(*) from public.notifications where kind = 'hostDemand') = 3, 'Cidade com equipamento: sem aviso de demanda');

\echo 'Cidade sem oferta: todos os testes passaram'
