\set ON_ERROR_STOP 1
-- Central de ajuda (chat com a equipe) e SOS durante o uso. Num banco novo, depois de todas as migrações.
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
 ('00000000-0000-0000-0000-00000000000d', 'bia@exemplo.com', '{"full_name":"Bia Souza"}'),
 ('00000000-0000-0000-0000-00000000000c', 'equipe@hiscoot.com.br', '{"full_name":"Equipe Hi Scoot"}');
update public.profile_private set is_admin = true where id = '00000000-0000-0000-0000-00000000000c';
insert into public.equipment (id, host_id, type, title, description, daily_price, city, area, pickup_time, return_time, review_status)
  values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'scooter', 'Patinete', 'Ok.', 45, 'Mogi Mirim', 'Centro', '08:00', '18:00', 'approved');
insert into public.bookings (id, equipment_id, rider_id, host_id, start_date, end_date, host_daily_price, pickup_time, return_time, status)
  values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b',
          '00000000-0000-0000-0000-00000000000a', public.today_sp() + 1, public.today_sp() + 1, 45, '10:00', '12:00', 'active');

-- Atendimento
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
create temp table ids (name text, id uuid);
grant all on ids to authenticated;
insert into ids values ('t', public.open_support_ticket('payment', 'Paguei e não confirmou.'));
select pg_temp.ok((select count(*) from public.support_messages) = 1, 'Rider abre atendimento com a mensagem');
select public.send_support_message((select id from ids where name = 't'), 'Foi no cartão.');
select pg_temp.fails($$insert into public.support_messages (ticket_id, body) values ((select id from ids where name = 't'), 'x')$$, '42501', 'Mensagem só pela função');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.ok((select count(*) from public.support_tickets) = 0, 'Outra pessoa não vê o atendimento');
select pg_temp.fails($$select public.send_support_message((select id from ids where name = 't'), 'oi')$$, 'not_allowed', 'Outra pessoa não escreve');
reset role;
select pg_temp.ok((select count(*) from public.notifications where kind = 'supportNew') = 2, 'Equipe avisada das mensagens');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.send_support_message((select id from ids where name = 't'), 'Já confirmamos, obrigado!');
select pg_temp.ok((select status from public.support_tickets) = 'answered', 'Resposta da equipe marca como respondido');
select pg_temp.ok((select from_team from public.support_messages order by created_at desc limit 1), 'Mensagem marcada como da equipe');
select public.send_support_message((select id from ids where name = 't'), '', true);
select pg_temp.ok((select status from public.support_tickets) = 'closed', 'Equipe encerra o atendimento');
reset role;
select pg_temp.ok((select count(*) from public.notifications where kind = 'supportReply' and user_id = '00000000-0000-0000-0000-00000000000b') >= 1, 'Rider avisado da resposta');

-- SOS
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.fails($$select public.report_sos('20000000-0000-0000-0000-000000000001', 'accident', 'Caí')$$, 'not_allowed', 'Só o Rider da reserva aciona o SOS');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.report_sos('20000000-0000-0000-0000-000000000001', 'accident', 'Caí na ciclovia, estou bem', -22.43, -46.95);
reset role;
select pg_temp.ok((select count(*) from public.notifications where kind = 'sosAlert') = 2, 'SOS avisa a equipe e o Host');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.ok((select count(*) from public.support_tickets where kind = 'sos') = 1, 'Host vê o SOS da reserva dele');
select pg_temp.ok((select count(*) from public.support_tickets where kind = 'help') = 0, 'Host não vê o atendimento do Rider');

\echo 'Atendimento e SOS: todos os testes passaram'
