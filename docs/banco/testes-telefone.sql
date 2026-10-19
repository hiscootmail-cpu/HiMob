\set ON_ERROR_STOP 1
-- Testes do telefone no cadastro. Rodam depois de todas as migrações, num banco novo.
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
 ('00000000-0000-0000-0000-00000000000a', 'rafael@exemplo.com', '{"full_name":"Rafael Santos","phone":" (11) 95555-0101 "}'),
 ('00000000-0000-0000-0000-00000000000b', 'ana@exemplo.com', '{"full_name":"Ana Paula Lima"}');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.ok((select phone from public.profile_private) = '(11) 95555-0101', 'telefone do cadastro fica guardado na parte privada do perfil');
select pg_temp.ok((select display_name from public.profiles where id = auth.uid()) = 'Rafael S.', 'nome curto continua igual');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select phone from public.profile_private) = '', 'conta antiga sem telefone continua funcionando (o perfil pede o telefone)');
select pg_temp.ok((select count(*) from public.profile_private) = 1, 'cada pessoa só vê o próprio telefone');
reset role;
\echo 'Telefone: todos os testes passaram'
