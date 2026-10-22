\set ON_ERROR_STOP 1
-- Cidade onde mora e cidade secundária no cadastro. Num banco novo, depois de todas as migrações.
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
 ('00000000-0000-0000-0000-00000000000a', 'ana@exemplo.com', '{"full_name":"Ana Souza","phone":"19955550101","city":"Mogi Mirim","city_state":"sp","second_city":"Campinas","second_city_state":"SP"}'),
 ('00000000-0000-0000-0000-00000000000b', 'bia@exemplo.com', '{"full_name":"Bia Lima","city":"Cidade Inventada","city_state":"XX"}'),
 ('00000000-0000-0000-0000-00000000000d', 'caio@exemplo.com', '{"full_name":"Caio Reis"}');

select pg_temp.ok((select city = 'Mogi Mirim' and city_state = 'SP' and second_city = 'Campinas' and second_city_state = 'SP'
                   from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'Cadastro guarda as duas cidades com o estado');
select pg_temp.ok((select city = '' and city_state is null from public.profiles where id = '00000000-0000-0000-0000-00000000000b'), 'Estado inválido: fica sem cidade (pede ao entrar)');
select pg_temp.ok((select city = '' and city_state is null and second_city is null from public.profiles where id = '00000000-0000-0000-0000-00000000000d'), 'Cadastro antigo sem cidade');
select pg_temp.ok((select state = 'São Paulo' and state_code = 'SP' and country = 'BR' from public.city_regions where city_key = public.city_key('Campinas')), 'Cidade escolhida entra nas regiões');

-- A própria pessoa escolhe as cidades depois
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
update public.profiles set city = 'Jaguariúna', city_state = 'SP', second_city = 'Rio de Janeiro', second_city_state = 'RJ' where id = auth.uid();
select pg_temp.ok((select second_city_state = 'RJ' from public.profiles where id = auth.uid()), 'Pessoa grava as próprias cidades');
reset role;
select pg_temp.ok((select country = 'BR' and state = 'Rio de Janeiro' from public.city_regions where city_key = public.city_key('Rio de Janeiro')), 'Região da cidade secundária guardada');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.fails($$update public.profiles set second_city = 'Santos', second_city_state = null where id = auth.uid()$$, '23514', 'Cidade secundária sem estado não vale');
select pg_temp.fails($$update public.profiles set city_state = 'São Paulo' where id = auth.uid()$$, '23514', 'Estado só com a sigla');
-- Em viagem: cidade, estado e data de volta juntos
update public.profiles set travel_city = 'Ubatuba', travel_city_state = 'SP', travel_from = public.today_sp() + 2, travel_until = public.today_sp() + 7 where id = auth.uid();
select pg_temp.ok((select travel_city = 'Ubatuba' from public.profiles where id = auth.uid()), 'Pessoa marca a viagem');
select pg_temp.fails($$update public.profiles set travel_until = null where id = auth.uid()$$, '23514', 'Viagem sem data de volta não vale');
select pg_temp.fails($$update public.profiles set travel_from = null where id = auth.uid()$$, '23514', 'Viagem sem data de ida não vale');
select pg_temp.fails($$update public.profiles set travel_from = travel_until + 1 where id = auth.uid()$$, '23514', 'Ida depois da volta não vale');
update public.profiles set travel_city = null, travel_city_state = null, travel_from = null, travel_until = null where id = auth.uid();
select pg_temp.ok((select travel_city is null from public.profiles where id = auth.uid()), 'Pessoa encerra a viagem');
reset role;
select pg_temp.ok((select state_code = 'SP' from public.city_regions where city_key = public.city_key('Ubatuba')), 'Cidade da viagem entra nas regiões');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
update public.profiles set city = 'Bia', city_state = 'SP' where id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.as_user(null);
select pg_temp.ok((select city from public.profiles where id = '00000000-0000-0000-0000-00000000000b') = '', 'Ninguém muda a cidade de outra pessoa');

\echo 'Cidades: todos os testes passaram'
