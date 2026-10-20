\set ON_ERROR_STOP 1
-- Cupons de aluguel (ações por cidade, aluguel grátis). Num banco novo, depois de todas as migrações.
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
-- Dias liberados pelo Host (horários, 23/10/2026): libera 120 dias de todos os equipamentos.
create or replace function pg_temp.open_days() returns void language plpgsql as $f$
declare r text := current_setting('role'); s text := current_setting('request.jwt.claim.sub', true);
begin
  perform set_config('role', 'none', false);
  insert into public.equipment_available_days
    select e.id, d::date from public.equipment e, generate_series(public.today_sp(), public.today_sp() + 120, interval '1 day') d
    on conflict do nothing;
  perform set_config('role', r, false);
  perform set_config('request.jwt.claim.sub', coalesce(s, ''), false);
end $f$;
set client_min_messages = notice;

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a', 'host@exemplo.com', '{"full_name":"Hi Scoot Ação","phone":"11955550101"}'),
 ('00000000-0000-0000-0000-00000000000b', 'ana@exemplo.com', '{"full_name":"Ana Paula Lima","phone":"11955550102"}'),
 ('00000000-0000-0000-0000-00000000000d', 'bia@exemplo.com', '{"full_name":"Bia Souza","phone":"11955550103"}'),
 ('00000000-0000-0000-0000-00000000000c', 'equipe@hiscoot.com.br', '{"full_name":"Equipe Hi Scoot"}');
update public.profile_private set is_admin = true where id = '00000000-0000-0000-0000-00000000000c';
update public.profiles set identity_status = 'approved';
-- Mercado Pago ligado: a reserva grátis precisa funcionar mesmo assim.
update public.app_settings set value = 'on' where key = 'mercado_pago';

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.become_host();
insert into public.equipment (id, host_id, type, title, description, daily_price, city, area, pickup_time, return_time) values
  ('10000000-0000-0000-0000-000000000001', auth.uid(), 'scooter', 'Patinete Mogi', 'Ok.', 45, 'Mogi Mirim', 'Centro', '10:00', '17:00'),
  ('10000000-0000-0000-0000-000000000002', auth.uid(), 'scooter', 'Patinete Sampa', 'Ok.', 45, 'São Paulo', 'Centro', '10:00', '17:00');
reset role;
update public.equipment set review_status = 'approved';

-- A equipe cria os cupons
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into public.coupons (code, city) values ('SCOOTEMMOGI', 'Mogi Mirim'), ('SCOOTEMSAMPA', 'Sao Paulo');
insert into public.coupons (code, city, max_uses, per_person, max_days) values ('UMDIA', null, 2, 1, 1);
select pg_temp.fails($$insert into public.coupons (code) values ('com espaço')$$, '23514', 'Código só com letras e números');

-- Rider não vê a lista de cupons, mas confere o seu
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.coupons) = 0, 'Rider não vê a lista de cupons');
select pg_temp.ok(public.check_coupon('scootemmogi', '10000000-0000-0000-0000-000000000001', public.today_sp() + 3, public.today_sp() + 4) = 'free', 'Cupom vale digitado em minúsculas');
select pg_temp.ok(public.check_coupon('ScootemSampa', '10000000-0000-0000-0000-000000000002', public.today_sp() + 3, public.today_sp() + 4) = 'free', 'Cidade com acento confere (São Paulo = Sao Paulo)');
select pg_temp.fails($$select public.check_coupon('ScootemMogi', '10000000-0000-0000-0000-000000000002', public.today_sp() + 3, public.today_sp() + 4)$$, 'coupon_city', 'Cupom de Mogi não vale em São Paulo');
select pg_temp.fails($$select public.check_coupon('NAOEXISTE', '10000000-0000-0000-0000-000000000001', public.today_sp() + 3, public.today_sp() + 4)$$, 'coupon_invalid', 'Cupom que não existe');

-- Reserva grátis: o Host aceita e já fica confirmada, sem pagamento e sem Mercado Pago
create temp table ids (name text, id uuid);
grant all on ids to authenticated;
select pg_temp.open_days();
insert into ids select 'g1', public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 3, public.today_sp() + 5, 'ScootemMogi');
select pg_temp.ok((select free and coupon_code = 'SCOOTEMMOGI' from public.bookings where id = (select id from ids where name = 'g1')), 'Reserva guarda o cupom e fica grátis');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.ok(public.decide_booking((select id from ids where name = 'g1'), true) = 'confirmed', 'Host sem Mercado Pago aceita reserva grátis');
select pg_temp.ok((select status from public.bookings where id = (select id from ids where name = 'g1')) = 'confirmed', 'Reserva grátis já fica confirmada');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.cancel_booking((select id from ids where name = 'g1'));
select pg_temp.ok((select status from public.bookings where id = (select id from ids where name = 'g1')) = 'cancelled', 'Reserva grátis cancela sem devolução');

-- Reserva sem cupom continua pedindo Mercado Pago do Host
select pg_temp.open_days();
insert into ids select 'p1', public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 10, public.today_sp() + 11);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.fails($$select public.decide_booking((select id from ids where name = 'p1'), true)$$, 'mp_not_connected', 'Sem cupom: Host sem Mercado Pago não aceita');

-- Limites opcionais
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.open_days();
select pg_temp.fails($$select public.request_booking('10000000-0000-0000-0000-000000000002', public.today_sp() + 20, public.today_sp() + 22, 'UMDIA')$$, 'coupon_days', 'Cupom de 1 dia não vale para 3 dias');
select pg_temp.open_days();
insert into ids select 'u1', public.request_booking('10000000-0000-0000-0000-000000000002', public.today_sp() + 20, public.today_sp() + 20, 'UMDIA');
select pg_temp.open_days();
select pg_temp.fails($$select public.request_booking('10000000-0000-0000-0000-000000000002', public.today_sp() + 25, public.today_sp() + 25, 'UMDIA')$$, 'coupon_already_used', 'Uma vez por pessoa');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.open_days();
insert into ids select 'u2', public.request_booking('10000000-0000-0000-0000-000000000002', public.today_sp() + 30, public.today_sp() + 30, 'UMDIA');
reset role;
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-00000000000e', 'caio@exemplo.com', '{"full_name":"Caio Lima","phone":"11955550104"}');
update public.profiles set identity_status = 'approved' where id = '00000000-0000-0000-0000-00000000000e';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
select pg_temp.open_days();
select pg_temp.fails($$select public.request_booking('10000000-0000-0000-0000-000000000002', public.today_sp() + 35, public.today_sp() + 35, 'UMDIA')$$, 'coupon_used_up', 'Limite total de usos');

-- A equipe desliga o cupom
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
update public.coupons set active = false where code = 'SCOOTEMSAMPA';
select pg_temp.ok((select count(*) from public.bookings where coupon_code is not null) = 3, 'Equipe vê as reservas com cupom');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.fails($$select public.check_coupon('ScootemSampa', '10000000-0000-0000-0000-000000000002', public.today_sp() + 3, public.today_sp() + 4)$$, 'coupon_invalid', 'Cupom desligado não vale');
select pg_temp.fails($$insert into public.coupons (code) values ('HACK')$$, '42501', 'Rider não cria cupom');
-- Cupom de desconto: x% no aluguel e y% na taxa (20/10/2026)
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.fails($$insert into public.coupons (code, kind) values ('SEMPORCENTO', 'discount')$$, '23514', 'Cupom de desconto precisa de alguma porcentagem');
select pg_temp.fails($$insert into public.coupons (code, kind, rental_percent) values ('DEMAIS', 'discount', 120)$$, '23514', 'Porcentagem até 100');
insert into public.coupons (code, kind, rental_percent, fee_percent) values ('DEZVINTE', 'discount', 10, 20);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select rental_percent = 10 and fee_percent = 20 and kind = 'discount' from public.coupon_preview('dezvinte', '10000000-0000-0000-0000-000000000001', public.today_sp() + 40, public.today_sp() + 40)), 'Rider vê as porcentagens do cupom');
select pg_temp.open_days();
insert into ids select 'd1', public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 40, public.today_sp() + 40, 'DezVinte');
select pg_temp.ok((select coupon_rental_percent = 10 and coupon_fee_percent = 20 and not free from public.bookings where id = (select id from ids where name = 'd1')), 'Reserva guarda os descontos e não fica grátis');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into public.coupons (code, kind, rental_percent, fee_percent) values ('TUDO100', 'discount', 100, 100);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.open_days();
insert into ids select 'd2', public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 45, public.today_sp() + 45, 'TUDO100');
select pg_temp.ok((select free from public.bookings where id = (select id from ids where name = 'd2')), '100% nas duas partes = aluguel grátis');
reset role;
\echo 'Cupons: todos os testes passaram'
