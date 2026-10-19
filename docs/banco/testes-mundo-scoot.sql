\set ON_ERROR_STOP 1
-- Mundo Scoot: todos veem o que está ativo; só a equipe cria, muda e apaga. Num banco novo, depois de todas as migrações.
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
 ('00000000-0000-0000-0000-00000000000c', 'equipe@hiscoot.com.br', '{"full_name":"Equipe Hi Scoot"}');
update public.profile_private set is_admin = true where id = '00000000-0000-0000-0000-00000000000c';

-- A equipe cria
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into public.world_products (id, name, description, price) values
  ('50000000-0000-0000-0000-000000000001', 'Capacete Hi Scoot', 'Tamanho M.', 189.90),
  ('50000000-0000-0000-0000-000000000002', 'Luva', '', 59);
update public.world_products set active = false where id = '50000000-0000-0000-0000-000000000002';
insert into public.world_videos (title, youtube_id) values ('Como pilotar com segurança', 'dQw4w9WgXcQ');
insert into public.world_places (kind, name, address, city, phone, services, latitude, longitude) values
  ('workshop', 'Oficina Centro', 'Rua A, 100', 'Campinas', '19999990000', 'Troca de pneu', -22.9, -47.06),
  ('partner', 'Loja Parceira', 'Av. B, 200', 'Campinas', null, '', null, null);
insert into storage.objects (bucket_id, name) values ('world-photos', 'produtos/capacete.jpg');
select pg_temp.ok((select count(*) from public.world_products) = 2, 'Equipe vê produtos ativos e escondidos');
select pg_temp.fails($$insert into public.world_videos (title, youtube_id) values ('Errado', 'https://youtu.be/x')$$, '23514', 'Vídeo só aceita o código do YouTube');
select pg_temp.fails($$insert into public.world_places (kind, name, address, city, latitude) values ('workshop', 'X Oficina', 'Rua C, 1', 'Campinas', -22)$$, '23514', 'Local precisa de latitude e longitude juntas');
select pg_temp.fails($$insert into public.world_products (name, price) values ('Grátis', 0)$$, '23514', 'Produto precisa de preço');

-- Visitante sem conta só vê o que está ativo
select pg_temp.as_user(null);
select pg_temp.ok((select count(*) from public.world_products) = 1, 'Visitante vê só o produto ativo');
select pg_temp.ok((select count(*) from public.world_videos) = 1, 'Visitante vê os vídeos');
select pg_temp.ok((select count(*) from public.world_places) = 2, 'Visitante vê lojas parceiras e oficinas');
select pg_temp.ok((select count(*) from storage.objects where bucket_id = 'world-photos') = 1, 'Visitante vê as fotos dos produtos');
select pg_temp.fails($$insert into public.world_products (name, price) values ('Invasor', 10)$$, '42501', 'Visitante não cria produto');

-- Pessoa com conta (não é da equipe) também só vê
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.ok((select count(*) from public.world_products) = 1, 'Pessoa com conta vê só o produto ativo');
select pg_temp.fails($$insert into public.world_videos (title, youtube_id) values ('Meu vídeo', 'abcdefghijk')$$, '42501', 'Pessoa com conta não cria vídeo');
update public.world_products set price = 1 where id = '50000000-0000-0000-0000-000000000001';
delete from public.world_places;
select pg_temp.ok((select price from public.world_products where id = '50000000-0000-0000-0000-000000000001') = 189.90, 'Pessoa com conta não muda preço');
select pg_temp.ok((select count(*) from public.world_places) = 2, 'Pessoa com conta não apaga local');
select pg_temp.fails($$insert into storage.objects (bucket_id, name) values ('world-photos', 'x.jpg')$$, '42501', 'Pessoa com conta não envia foto');

-- A equipe apaga
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
delete from public.world_products where id = '50000000-0000-0000-0000-000000000002';
delete from storage.objects where bucket_id = 'world-photos';
select pg_temp.ok((select count(*) from public.world_products) = 1, 'Equipe apaga produto');
select pg_temp.ok((select count(*) from storage.objects) = 0, 'Equipe apaga foto');
reset role;
\echo 'Mundo Scoot: todos os testes passaram'
