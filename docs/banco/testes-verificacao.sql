\set ON_ERROR_STOP 1
-- Só aluga e anuncia depois da verificação. Depois de todas as migrações, num banco novo.
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

-- Host em análise não anuncia
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.become_host();
select pg_temp.fails($$insert into public.equipment (host_id, type, title, description, daily_price, city, area, pickup_time, return_time) values (auth.uid(), 'scooter', 'Patinete', 'Ok.', 45, 'São Paulo', 'Jardins', '09:00', '18:00')$$, '42501', 'Host com documento em análise não cria anúncio');

-- A equipe aprova o Host; aí ele anuncia
reset role;
insert into public.identity_submissions (id, user_id, kind, front_path, back_path) values ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'document', 'f', 'b');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.review_identity('40000000-0000-0000-0000-000000000001', true);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.equipment (id, host_id, type, title, description, daily_price, city, area, pickup_time, return_time)
  values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'scooter', 'Patinete Aro 10', 'Com capacete.', 45, 'São Paulo', 'Jardins', '09:00', '18:00');
select pg_temp.ok((select count(*) from public.equipment) = 1, 'Host aprovado cria anúncio');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.review_listing('10000000-0000-0000-0000-000000000001', true);

-- Rider em análise vê, conversa, mas não reserva
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.listings()) = 1, 'Rider em análise vê os equipamentos');
select pg_temp.ok(public.start_conversation('10000000-0000-0000-0000-000000000001') is not null, 'Rider em análise conversa com o Host');
select pg_temp.fails($$select public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 5, public.today_sp() + 6)$$, 'identity_required', 'Rider em análise não pede reserva');
reset role;
update public.profiles set identity_status = 'approved' where id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok(public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 5, public.today_sp() + 6) is not null, 'Rider aprovado pede reserva');
reset role;
\echo 'Verificação para alugar: todos os testes passaram'
