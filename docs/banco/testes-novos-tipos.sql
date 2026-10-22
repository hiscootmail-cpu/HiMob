\set ON_ERROR_STOP 1
-- Novos tipos (skate elétrico, jetboard) e jetboard só para maiores de 21 anos. Num banco novo, depois de todas as migrações.
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
 ('00000000-0000-0000-0000-00000000000a', 'host@exemplo.com', '{"full_name":"Rafael Santos","phone":"11955550101"}'),
 ('00000000-0000-0000-0000-00000000000b', 'ana@exemplo.com', '{"full_name":"Ana Paula Lima","phone":"11955550102"}'),
 ('00000000-0000-0000-0000-00000000000d', 'bia@exemplo.com', '{"full_name":"Bia Souza","phone":"11955550103"}');
update public.profiles set identity_status = 'approved';

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.become_host();
insert into public.equipment (id, host_id, type, title, description, daily_price, city, area, pickup_time, return_time) values
  ('10000000-0000-0000-0000-000000000001', auth.uid(), 'jetboard', 'Jetboard', 'Ok.', 300, 'Ubatuba', 'Praia', '08:00', '18:00'),
  ('10000000-0000-0000-0000-000000000002', auth.uid(), 'eskate', 'Skate', 'Ok.', 60, 'Ubatuba', 'Centro', '08:00', '18:00');
select pg_temp.ok((select count(*) from public.equipment) = 2, 'Host anuncia jetboard e skate elétrico');
select pg_temp.fails($$insert into public.equipment (host_id, type, title, description, daily_price, city, area, pickup_time, return_time) values (auth.uid(), 'barco', 'X', 'Ok.', 60, 'Ubatuba', 'Centro', '08:00', '18:00')$$, '23514', 'Tipo desconhecido não entra');
insert into public.equipment_available_days select e, public.today_sp() + n from unnest(array['10000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000002']) e, generate_series(1, 5) n;
reset role;
update public.equipment set review_status = 'approved';

-- Sem data de nascimento: não reserva jetboard (skate pode)
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.fails($$select public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 2, '10:00', public.today_sp() + 2, '12:00')$$, 'birth_date_required', 'Jetboard pede data de nascimento');
select pg_temp.ok(public.request_booking('10000000-0000-0000-0000-000000000002', public.today_sp() + 2, '10:00', public.today_sp() + 2, '12:00') is not null, 'Skate elétrico não pede idade');

-- Menos de 21 anos: não reserva
select public.set_birth_date((public.today_sp() - interval '20 years')::date);
select pg_temp.fails($$select public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 2, '10:00', public.today_sp() + 2, '12:00')$$, 'too_young', 'Menor de 21 não reserva jetboard');
select pg_temp.fails($$select public.set_birth_date(public.today_sp() + 1)$$, 'birth_date_invalid', 'Nascimento no futuro não vale');

-- 21 anos ou mais: reserva
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.set_birth_date((public.today_sp() - interval '30 years')::date);
select pg_temp.ok(public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 3, '10:00', public.today_sp() + 3, '12:00') is not null, 'Maior de 21 reserva jetboard');
select pg_temp.fails($$select public.set_birth_date((public.today_sp() - interval '25 years')::date)$$, 'birth_date_locked', 'Com documento aprovado, a data não muda');
select pg_temp.fails($$update public.profile_private set birth_date = '2000-01-01' where id = auth.uid()$$, '42501', 'Data de nascimento só pela função');

\echo 'Novos tipos: todos os testes passaram'
