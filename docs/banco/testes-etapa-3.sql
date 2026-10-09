\set ON_ERROR_STOP 1
set client_min_messages = warning;
create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$
begin
  if u is null then perform set_config('role', 'anon', false); perform set_config('request.jwt.claim.sub', '', false);
  else perform set_config('role', 'authenticated', false); perform set_config('request.jwt.claim.sub', u, false); end if;
end $$;
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if not cond then raise exception 'FALHOU: %', msg; end if; raise notice 'OK  %', msg; end $$;
create or replace function pg_temp.fails(sql text, expected text, msg text) returns void language plpgsql as $$
begin execute sql; raise exception 'FALHOU: % (não deu erro)', msg;
exception when others then
  if sqlerrm like 'FALHOU%' then raise; end if;
  if expected is not null and sqlerrm <> expected and sqlstate <> expected then raise exception 'FALHOU: % (erro %: %)', msg, sqlstate, sqlerrm; end if;
  raise notice 'OK  %', msg;
end $$;
set client_min_messages = notice;

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a', 'rafael@exemplo.com', '{"full_name":"Rafael Santos"}'),
 ('00000000-0000-0000-0000-00000000000b', 'ana@exemplo.com', '{"full_name":"Ana Paula Lima"}'),
 ('00000000-0000-0000-0000-00000000000c', 'equipe@hiscoot.com.br', '{"full_name":"Equipe Hi Scoot"}');
update public.profile_private set is_admin = true where id = '00000000-0000-0000-0000-00000000000c';

-- Host cria anúncio com 4 fotos
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.become_host();
insert into public.equipment (id, host_id, type, title, description, daily_price, city, area, pickup_time, return_time)
  values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'scooter', 'Patinete Aro 10', 'Com capacete.', 45, 'São Paulo', 'Jardins', '09:00', '18:00');
insert into public.equipment_private (equipment_id, pickup_address, latitude, longitude) values ('10000000-0000-0000-0000-000000000001', 'Rua A, 1', -23.5649, -46.6631);
insert into public.equipment_photos (equipment_id, path, position)
  select '10000000-0000-0000-0000-000000000001', auth.uid()::text || '/eq1/' || g || '.jpg', g from generate_series(0, 3) g;
select pg_temp.fails($$select public.review_listing('10000000-0000-0000-0000-000000000001', true)$$, 'not_allowed', 'Host não aprova o próprio anúncio');

-- Equipe
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.fails($$select public.review_listing('10000000-0000-0000-0000-000000000001', false, 'curto')$$, 'reason_required', 'recusar exige motivo de 10+ letras');
select public.review_listing('10000000-0000-0000-0000-000000000001', true);
select pg_temp.ok((select count(*) from public.notifications) = 0, 'equipe não lê avisos de outras pessoas');

select pg_temp.as_user(null);
select pg_temp.ok((select count(*) from public.listings()) = 1, 'busca pública mostra o anúncio aprovado');
select pg_temp.ok((select array_length(photos, 1) from public.listings('10000000-0000-0000-0000-000000000001')) = 4, 'busca traz as 4 fotos na ordem');
select pg_temp.ok((select host_name from public.listings()) = 'Rafael S.', 'busca mostra só o nome curto do Host');
select pg_temp.fails($$select public.submit_listing_edit('10000000-0000-0000-0000-000000000001', '{}')$$, '42501', 'visitante não envia edição');

-- Host recebe aviso e tenta editar antes de 30 dias
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.ok((select kind from public.notifications) = 'listingApproved', 'Host recebe aviso de anúncio aprovado');
select pg_temp.fails($$select public.submit_listing_edit('10000000-0000-0000-0000-000000000001', '{"daily_price": 50}')$$, 'too_soon', 'edição antes de 30 dias é recusada');
reset role; update public.equipment set last_sent_at = now() - interval '31 days';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.fails($$select public.submit_listing_edit('10000000-0000-0000-0000-000000000001', '{"label_code": "X"}')$$, 'invalid_field', 'edição não mexe em campo proibido');
select pg_temp.fails($$select public.submit_listing_edit('10000000-0000-0000-0000-000000000001', '{"photos": ["00000000-0000-0000-0000-00000000000b/a.jpg","b","c","d"]}')$$, 'not_allowed', 'edição não usa fotos de outra pessoa');
select pg_temp.ok(public.submit_listing_edit('10000000-0000-0000-0000-000000000001', '{"daily_price": 50, "title": "Patinete Aro 10 Plus"}') = 'edit', 'edição de publicado vai para análise');
select pg_temp.fails($$select public.submit_listing_edit('10000000-0000-0000-0000-000000000001', '{"daily_price": 55}')$$, 'edit_in_review', 'segunda edição com outra em análise é recusada');
select pg_temp.as_user(null);
select pg_temp.ok((select daily_price from public.listings()) = 45, 'anúncio antigo segue no ar enquanto a edição é analisada');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.review_listing_edit((select id from public.equipment_edits limit 1), true);
select pg_temp.as_user(null);
select pg_temp.ok((select daily_price from public.listings()) = 50 and (select title from public.listings()) = 'Patinete Aro 10 Plus', 'edição aprovada entra no anúncio');

-- Identidade
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.identity_submissions (id, user_id, kind, front_path, back_path) values ('40000000-0000-0000-0000-000000000001', auth.uid(), 'document', 'f', 'b');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.ok(public.review_identity('40000000-0000-0000-0000-000000000001', false, 'Nome não confere com o cadastro.') = 'rejected', '1ª recusa de documento: recusado');
reset role; insert into public.identity_submissions (id, user_id, kind, letter_path) values ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 'letter', 'l');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.ok(public.review_identity('40000000-0000-0000-0000-000000000002', false, 'Carta sem o CPF, envie de novo.') = 'rejected', 'carta recusada não conta como recusa de documento');
reset role; insert into public.identity_submissions (id, user_id, kind, front_path, back_path) values ('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000b', 'document', 'f2', 'b2');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.ok(public.review_identity('40000000-0000-0000-0000-000000000003', false, 'Nome ainda não confere.') = 'blocked', '2ª recusa de documento bloqueia');
reset role; insert into public.identity_submissions (id, user_id, kind, letter_path) values ('40000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000b', 'letter', 'l2');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.ok(public.review_identity('40000000-0000-0000-0000-000000000004', true) = 'approved', 'carta aprovada desbloqueia e verifica');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.notifications where kind like 'document%') = 4, 'pessoa recebe os 4 avisos de documento');
select pg_temp.fails($$select public.review_identity('40000000-0000-0000-0000-000000000004', true)$$, 'not_allowed', 'só a equipe decide documentos');
reset role;
select 'ETAPA 3: TODOS OS TESTES PASSARAM' as resultado;
