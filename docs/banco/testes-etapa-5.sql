\set ON_ERROR_STOP 1
-- Testes da etapa 5 (conversas, avaliações e avisos). Rodam depois de todas as migrações, num banco novo.
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

-- Host (a), Rider (b), outra pessoa (d), equipe (c)
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a', 'rafael@exemplo.com', '{"full_name":"Rafael Santos"}'),
 ('00000000-0000-0000-0000-00000000000b', 'ana@exemplo.com', '{"full_name":"Ana Paula Lima"}'),
 ('00000000-0000-0000-0000-00000000000d', 'joao@exemplo.com', '{"full_name":"João Victor"}'),
 ('00000000-0000-0000-0000-00000000000c', 'equipe@hiscoot.com.br', '{"full_name":"Equipe Hi Scoot"}');
update public.profile_private set is_admin = true where id = '00000000-0000-0000-0000-00000000000c';
update public.profile_private set phone = '(11) 95555-0101' where id = '00000000-0000-0000-0000-00000000000a';

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.become_host();
insert into public.equipment (id, host_id, type, title, description, daily_price, city, area, pickup_time, return_time)
  values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'scooter', 'Patinete Aro 10', 'Com capacete.', 45, 'São Paulo', 'Jardins', '09:00', '18:00');
insert into public.equipment_private (equipment_id, pickup_address, latitude, longitude) values ('10000000-0000-0000-0000-000000000001', 'Rua A, 1', -23.5649, -46.6631);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.fails($$select public.start_conversation('10000000-0000-0000-0000-000000000001')$$, 'not_allowed', 'não começa conversa sobre anúncio em análise');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.review_listing('10000000-0000-0000-0000-000000000001', true);

-- Conversa
create temp table ids (name text primary key, id uuid);
grant all on ids to anon, authenticated;
select pg_temp.as_user(null);
select pg_temp.fails($$select public.start_conversation('10000000-0000-0000-0000-000000000001')$$, '42501', 'visitante não começa conversa');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.fails($$select public.start_conversation('10000000-0000-0000-0000-000000000001')$$, 'own_listing', 'Host não conversa com ele mesmo');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into ids select 'c1', public.start_conversation('10000000-0000-0000-0000-000000000001');
select pg_temp.ok(public.start_conversation('10000000-0000-0000-0000-000000000001') = (select id from ids where name = 'c1'), 'Falar com o Host de novo reaproveita a mesma conversa');
insert into public.messages (conversation_id, sender_id, body) values ((select id from ids where name = 'c1'), auth.uid(), 'Oi! Me chama no 11 98888-7777 ou ana@exemplo.com');
select pg_temp.ok((select body from public.messages) = 'Oi! Me chama no ••• ou •••', 'sem reserva aceita, telefone e e-mail são escondidos');
select pg_temp.ok((select count(*) from public.conversation_contact((select id from ids where name = 'c1'))) = 0, 'sem reserva aceita, contato do Host fica oculto');
select pg_temp.fails($$insert into public.messages (conversation_id, sender_id, body) values ((select id from ids where name = 'c1'), '00000000-0000-0000-0000-00000000000a', 'Falso')$$, '42501', 'ninguém envia mensagem em nome de outra pessoa');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.ok((select count(*) from public.conversations) = 0, 'outras pessoas não veem a conversa');
select pg_temp.ok((select count(*) from public.messages) = 0, 'outras pessoas não leem as mensagens');
select pg_temp.fails($$insert into public.messages (conversation_id, sender_id, body) values ((select id from ids where name = 'c1'), auth.uid(), 'Intruso')$$, '42501', 'outras pessoas não escrevem na conversa');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.ok((select count(*) from public.notifications where kind = 'newMessage' and name = 'Ana L.') = 1, 'Host recebe aviso de mensagem nova');
insert into public.messages (conversation_id, sender_id, body) values ((select id from ids where name = 'c1'), auth.uid(), 'Olá, Ana!');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.messages (conversation_id, sender_id, body) values ((select id from ids where name = 'c1'), auth.uid(), 'Ainda está livre?');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.ok((select count(*) from public.notifications where kind = 'newMessage') = 1, 'mensagens seguidas geram um aviso só, até a pessoa ler');
update public.messages set read_at = now() where sender_id <> auth.uid();
select pg_temp.ok((select count(*) from public.messages where read_at is not null) = 2, 'Host marca como lidas as mensagens recebidas');
select pg_temp.fails($$update public.messages set body = 'mudei' where sender_id = auth.uid()$$, '42501', 'ninguém muda o texto de uma mensagem');

-- Reserva aceita libera o contato
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into ids select 'b1', public.request_booking('10000000-0000-0000-0000-000000000001', public.today_sp() + 2, public.today_sp() + 3);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.decide_booking((select id from ids where name = 'b1'), true);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select phone from public.conversation_contact((select id from ids where name = 'c1'))) = '(11) 95555-0101', 'com reserva aceita, Rider vê o contato do Host');
insert into public.messages (conversation_id, sender_id, body) values ((select id from ids where name = 'c1'), auth.uid(), 'Meu número: 11 98888-7777');
select pg_temp.ok((select count(*) from public.messages where body like '%98888-7777%') = 1, 'com reserva aceita, o contato não é mais escondido');

-- Lembrete de retirada (amanhã)
select public.pay_booking_test((select id from ids where name = 'b1'));
reset role;
update public.bookings set start_date = public.today_sp() + 1, end_date = public.today_sp() + 2 where id = (select id from ids where name = 'b1');
select pg_temp.ok(public.send_pickup_reminders() = 1, 'lembrete sai para a retirada de amanhã');
select pg_temp.ok(public.send_pickup_reminders() = 0, 'lembrete não sai duas vezes');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.notifications where kind = 'pickupReminder') = 1, 'Rider recebe o lembrete');
select pg_temp.fails($$select public.send_pickup_reminders()$$, '42501', 'só o agendador do banco manda lembretes');

-- Avaliações
select pg_temp.fails($$select public.submit_review((select id from ids where name = 'b1'), 5, 5, 'Ótimo')$$, 'not_allowed', 'não avalia antes da devolução');
reset role;
insert into storage.objects (bucket_id, name, owner) values
  ('handoff-photos', '00000000-0000-0000-0000-00000000000a/r.jpg', '00000000-0000-0000-0000-00000000000a'),
  ('handoff-photos', '00000000-0000-0000-0000-00000000000a/d.jpg', '00000000-0000-0000-0000-00000000000a');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.confirm_handoff((select id from ids where name = 'b1'), 'pickup', '00000000-0000-0000-0000-00000000000a/r.jpg');
select public.confirm_handoff((select id from ids where name = 'b1'), 'return', '00000000-0000-0000-0000-00000000000a/d.jpg');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.fails($$select public.submit_review((select id from ids where name = 'b1'), 1, 1, 'Ruim')$$, 'not_allowed', 'quem não participou não avalia');
select pg_temp.fails($$insert into public.reviews (booking_id, author_id, target_id, target_role, rating) values ((select id from ids where name = 'b1'), auth.uid(), '00000000-0000-0000-0000-00000000000a', 'host', 1)$$, '42501', 'ninguém grava avaliação direto na tabela');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.fails($$select public.submit_review((select id from ids where name = 'b1'), 5, null, 'Ótimo')$$, 'rating_required', 'Rider precisa dar nota ao equipamento');
select pg_temp.fails($$select public.submit_review((select id from ids where name = 'b1'), 6, 5, '')$$, 'rating_required', 'nota vai de 1 a 5');
select pg_temp.fails($$select public.submit_review((select id from ids where name = 'b1'), 5, 5, repeat('a', 501))$$, 'comment_too_long', 'comentário até 500 letras');
select public.submit_review((select id from ids where name = 'b1'), 5, 4, 'Patinete ótimo, Host pontual.');
select pg_temp.fails($$select public.submit_review((select id from ids where name = 'b1'), 5, 5, '')$$, 'not_allowed', 'Rider avalia uma vez só');
select pg_temp.ok((select rider_reviewed from public.bookings where id = (select id from ids where name = 'b1')), 'reserva fica marcada como avaliada pelo Rider');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.ok((select count(*) from public.notifications where kind = 'reviewReceived' and name = 'Ana L.') = 1, 'Host recebe aviso da avaliação');
select public.submit_review((select id from ids where name = 'b1'), 4, null, 'Devolveu no horário.');
select pg_temp.ok((select equipment_rating is null and target_role = 'rider' from public.reviews where author_id = auth.uid()), 'Host avalia só o Rider (sem nota de equipamento)');

select pg_temp.as_user(null);
select pg_temp.ok((select count(*) from public.reviews) = 2, 'avaliações são públicas');
select pg_temp.ok((select rating_avg = 4 and rating_count = 1 and host_rating_avg = 5 from public.listings()), 'busca mostra a nota do equipamento e do Host');
reset role;
\echo 'Etapa 5: todos os testes passaram'
