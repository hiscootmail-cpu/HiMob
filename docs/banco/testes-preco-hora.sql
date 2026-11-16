\set ON_ERROR_STOP 1
-- Preço por hora com diária como teto e taxa 15% + 15% nas reservas novas. Num banco novo, depois de todas as migrações.
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
 ('00000000-0000-0000-0000-00000000000a', 'host@exemplo.com', '{"full_name":"Pedro Host","phone":"11955550101"}'),
 ('00000000-0000-0000-0000-00000000000b', 'ana@exemplo.com', '{"full_name":"Ana Rider","phone":"11955550102"}');
update public.profiles set identity_status = 'approved';
create or replace function public.mp_required() returns boolean language sql as $$ select false $$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.become_host();
-- Pedro: R$ 30,00 por hora, diária (teto) R$ 150,00, atende das 08h às 20h
insert into public.equipment (id, host_id, type, title, description, daily_price, hourly_price, city, area, pickup_time, return_time)
  values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'scooter', 'Patinete', 'Ok.', 150, 30, 'Salvador', 'Barra', '08:00', '20:00');
insert into public.equipment_available_days select '10000000-0000-0000-0000-000000000001', public.today_sp() + n from generate_series(1, 6) n;
reset role;
update public.equipment set review_status = 'approved';

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
create temp table ids (name text, id uuid);
insert into ids values ('2h', public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 1, '10:00', public.today_sp() + 1, '12:00'));
insert into ids values ('8h', public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 2, '09:00', public.today_sp() + 2, '17:00'));
insert into ids values ('26h', public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 4, '10:00', public.today_sp() + 5, '12:00'));
reset role;
select pg_temp.ok((select host_amount = 60 and host_hourly_price = 30 and fee_model = 'double' from public.bookings where id = (select id from ids where name = '2h')), '2 horas = 2 x R$ 30, taxa nova');
select pg_temp.ok((select host_amount = 150 from public.bookings where id = (select id from ids where name = '8h')), '8 horas passam da diária: vale a diária (R$ 150)');
select pg_temp.ok((select host_amount = 210 from public.bookings where id = (select id from ids where name = '26h')), '26 horas = 1 diária + 2 horas');
select pg_temp.ok((select hourly_price = 30 from public.listings('10000000-0000-0000-0000-000000000001')), 'Busca devolve o preço por hora');

-- Anúncio antigo, sem preço por hora: continua pela diária / horas de atendimento
insert into public.equipment (id, host_id, type, title, description, daily_price, city, area, pickup_time, return_time, review_status)
  values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'ebike', 'Bike', 'Ok.', 45, 'Mogi Mirim', 'Centro', '10:00', '17:00', 'approved');
insert into public.equipment_available_days values ('10000000-0000-0000-0000-000000000002', public.today_sp() + 3);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into ids values ('old', public.request_booking('10000000-0000-0000-0000-000000000002', public.today_sp() + 3, '10:00', public.today_sp() + 3, '13:00'));
reset role;
select pg_temp.ok((select host_amount = 19.29 and host_hourly_price is null from public.bookings where id = (select id from ids where name = 'old')), 'Sem preço por hora: regra antiga (3 x 45/7)');

-- Edição muda o preço por hora (equipe aplica)
update public.equipment set last_sent_at = now() - interval '40 days';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.ok(public.submit_listing_edit('10000000-0000-0000-0000-000000000001', '{"hourly_price": 35}') = 'edit', 'Host envia novo preço por hora');
reset role;
select public.apply_listing_changes('10000000-0000-0000-0000-000000000001', '{"hourly_price": 35}');
select pg_temp.ok((select hourly_price = 35 from public.equipment where id = '10000000-0000-0000-0000-000000000001'), 'Edição aplicada muda o preço por hora');
select pg_temp.fails($$update public.equipment set hourly_price = 0 where id = '10000000-0000-0000-0000-000000000001'$$, '23514', 'Preço por hora precisa ser maior que zero');

\echo 'Preço por hora: todos os testes passaram'
