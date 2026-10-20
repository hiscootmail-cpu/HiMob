\set ON_ERROR_STOP 1
-- A equipe cadastra equipamentos da Hi Scoot sem as regras do Host. Num banco novo, depois de todas as migrações.
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

-- Equipe sem verificação de identidade cria, aprova e edita na hora
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.become_host();
insert into public.equipment (id, host_id, type, title, description, daily_price, city, area, pickup_time, return_time)
  values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'scooter', 'Patinete Hi Scoot Mogi', 'Ok.', 45, 'Mogi Mirim', 'Centro', '10:00', '17:00');
select pg_temp.ok((select count(*) from public.equipment) = 1, 'Equipe sem verificação cria anúncio');
select public.review_listing('10000000-0000-0000-0000-000000000001', true);
select pg_temp.ok((select review_status from public.equipment) = 'approved', 'Equipe aprova o próprio anúncio');
select pg_temp.ok(public.submit_listing_edit('10000000-0000-0000-0000-000000000001', '{"title":"Patinete Hi Scoot Mogi Mirim"}') = 'edit', 'Equipe edita logo depois (sem esperar 30 dias)');

-- Host comum continua com as regras
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.become_host();
select pg_temp.fails($$insert into public.equipment (host_id, type, title, description, daily_price, city, area, pickup_time, return_time) values (auth.uid(), 'scooter', 'X', 'Ok.', 45, 'Mogi Mirim', 'Centro', '10:00', '17:00')$$, '42501', 'Host sem verificação não cria anúncio');
reset role;
update public.profiles set identity_status = 'approved' where id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.equipment (id, host_id, type, title, description, daily_price, city, area, pickup_time, return_time)
  values ('10000000-0000-0000-0000-000000000002', auth.uid(), 'scooter', 'Patinete', 'Ok.', 45, 'Mogi Mirim', 'Centro', '10:00', '17:00');
reset role;
update public.equipment set review_status = 'approved', last_sent_at = now() where id = '10000000-0000-0000-0000-000000000002';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.fails($$select public.submit_listing_edit('10000000-0000-0000-0000-000000000002', '{"title":"Outro"}')$$, 'too_soon', 'Host comum espera 30 dias para editar');
reset role;
\echo 'Equipe anuncia: todos os testes passaram'
