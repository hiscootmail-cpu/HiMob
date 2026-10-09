-- Testes de segurança da etapa 1. Cada bloco falha (para tudo) se a regra não funcionar.
\set ON_ERROR_STOP 1
set client_min_messages = warning;
create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$
begin
  if u is null then perform set_config('role', 'anon', false); perform set_config('request.jwt.claim.sub', '', false);
  else perform set_config('role', 'authenticated', false); perform set_config('request.jwt.claim.sub', u, false); end if;
end $$;
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if not cond then raise exception 'FALHOU: %', msg; end if; raise notice 'OK  %', msg; end $$;
set client_min_messages = notice;

-- Pessoas: Rafael (Host), Ana (Rider), Equipe
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a', 'rafael@exemplo.com', '{"full_name":"Rafael Santos"}'),
 ('00000000-0000-0000-0000-00000000000b', 'ana@exemplo.com', '{"full_name":"Ana Paula Lima"}'),
 ('00000000-0000-0000-0000-00000000000c', 'equipe@hiscoot.com.br', '{"full_name":"Equipe Hi Scoot"}');
update public.profile_private set is_admin = true where id = '00000000-0000-0000-0000-00000000000c';
update public.profiles set identity_status = 'approved' where id in ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000c');
select pg_temp.ok((select display_name from public.profiles where id='00000000-0000-0000-0000-00000000000b') = 'Ana L.', 'cadastro cria perfil com nome curto "Ana L."');

-- Visitante
select pg_temp.as_user(null);
select pg_temp.ok((select count(*) from public.profiles) = 3, 'visitante vê perfis públicos');
do $$ begin perform 1 from public.profile_private; raise exception 'FALHOU: visitante leu dados privados'; exception when insufficient_privilege then raise notice 'OK  visitante não lê dados privados'; end $$;

-- Ana (Rider)
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.profile_private) = 1, 'Ana só vê os próprios dados privados');
do $$ begin update public.profile_private set is_admin = true where id = auth.uid(); raise exception 'FALHOU: Ana virou equipe'; exception when insufficient_privilege then raise notice 'OK  Ana não consegue se dar acesso de equipe'; end $$;
update public.profile_private set full_name = 'Ana Paula Souza', phone = '(11) 95555-0101' where id = auth.uid();
select pg_temp.ok((select display_name from public.profiles where id = auth.uid()) = 'Ana S.', 'nome ainda não verificado pode mudar e o nome curto acompanha');
do $$ begin insert into public.equipment (host_id, type, title, description, daily_price, city, area, pickup_time, return_time)
  values (auth.uid(), 'scooter', 'X', 'Y', 30, 'SP', 'Centro', '09:00', '18:00'); raise exception 'FALHOU: Ana anunciou sem ser Host';
  exception when insufficient_privilege then raise notice 'OK  quem não é Host não anuncia'; end $$;

-- Rafael (Host, verificado)
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin update public.profile_private set full_name = 'Outro Nome' where id = auth.uid(); raise exception 'FALHOU: nome verificado mudou';
  exception when raise_exception then if sqlerrm = 'name_locked' then raise notice 'OK  nome travado depois da verificação'; else raise; end if; end $$;
select public.become_host();
select pg_temp.ok((select is_host from public.profiles where id = auth.uid()), 'Quero ser Host em um clique');
insert into public.equipment (id, host_id, type, title, description, daily_price, city, area, pickup_time, return_time)
  values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'scooter', 'Patinete Aro 10', 'Com capacete.', 45, 'São Paulo', 'Jardins', '09:00', '18:00');
insert into public.equipment_private (equipment_id, pickup_address, latitude, longitude)
  values ('10000000-0000-0000-0000-000000000001', 'Rua Oscar Freire, 300', -23.564912, -46.663187);
do $$ begin update public.equipment set review_status = 'approved' where id = '10000000-0000-0000-0000-000000000001'; raise exception 'FALHOU: Host aprovou o próprio anúncio';
  exception when insufficient_privilege then raise notice 'OK  Host não aprova o próprio anúncio'; end $$;
select pg_temp.ok((select label_code from public.equipment_private) ~ '^HS-\d{6}$', 'código da etiqueta gerado pelo banco');

select pg_temp.as_user(null);
select pg_temp.ok((select count(*) from public.equipment) = 0, 'anúncio em análise não aparece na busca');
reset role; update public.equipment set review_status = 'approved';
select pg_temp.as_user(null);
select pg_temp.ok((select count(*) from public.equipment) = 1, 'anúncio aprovado aparece');
select pg_temp.ok((select latitude from public.equipment) = -23.56, 'mapa público mostra só a região aproximada');
do $$ begin perform 1 from public.equipment_private; raise exception 'FALHOU: visitante viu endereço'; exception when insufficient_privilege then raise notice 'OK  visitante não vê endereço nem etiqueta'; end $$;

-- Ana conversa com Rafael
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.equipment_private) = 0, 'Rider não vê endereço exato nem código da etiqueta');
insert into public.conversations (id, equipment_id, rider_id, host_id)
  values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', auth.uid(), '00000000-0000-0000-0000-00000000000a');
insert into public.messages (conversation_id, sender_id, body) values ('20000000-0000-0000-0000-000000000001', auth.uid(), 'Me chama no 11 95555-0101 ou ana@exemplo.com');
select pg_temp.ok((select body from public.messages) = 'Me chama no ••• ou •••', 'sem reserva aceita, o banco esconde telefone e e-mail');
select pg_temp.ok((select count(*) from public.conversation_contact('20000000-0000-0000-0000-000000000001')) = 0, 'sem reserva aceita, contato não sai');
do $$ begin insert into public.blocked_days values ('10000000-0000-0000-0000-000000000001', current_date + 3); raise exception 'FALHOU: Ana bloqueou dia do Rafael';
  exception when insufficient_privilege then raise notice 'OK  só o Host bloqueia dias do equipamento'; end $$;
do $$ begin insert into public.bookings (equipment_id, rider_id, host_id, start_date, end_date, host_daily_price, pickup_time, return_time, status)
  values ('10000000-0000-0000-0000-000000000001', auth.uid(), '00000000-0000-0000-0000-00000000000a', current_date+1, current_date+2, 1, '09:00', '18:00', 'confirmed'); raise exception 'FALHOU: Ana criou reserva paga direto';
  exception when insufficient_privilege then raise notice 'OK  reserva não é criada direto (só pelas regras da etapa 4)'; end $$;

-- Reserva aceita (feita pelo sistema)
reset role;
insert into public.bookings (id, equipment_id, rider_id, host_id, start_date, end_date, host_daily_price, pickup_time, return_time, status)
  values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a', current_date+3, current_date+5, 45, '09:00', '18:00', 'accepted');
do $$ begin insert into public.bookings (equipment_id, rider_id, host_id, start_date, end_date, host_daily_price, pickup_time, return_time, status)
  values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000a', current_date+5, current_date+6, 45, '09:00', '18:00', 'accepted'); raise exception 'FALHOU: duas reservas no mesmo dia';
  exception when exclusion_violation then raise notice 'OK  o banco recusa duas reservas aceitas no mesmo dia'; end $$;
insert into public.blocked_days values ('10000000-0000-0000-0000-000000000001', current_date + 10);

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.unavailable_days('10000000-0000-0000-0000-000000000001')) = 4, 'dias indisponíveis = 3 reservados + 1 bloqueado');
select pg_temp.ok(public.pickup_address('30000000-0000-0000-0000-000000000001') is null, 'antes do pagamento, Rider não recebe o endereço');
insert into public.messages (conversation_id, sender_id, body) values ('20000000-0000-0000-0000-000000000001', auth.uid(), 'Meu número: 11 95555-0101');
select pg_temp.ok((select body from public.messages order by created_at desc limit 1) like '%95555-0101', 'com reserva aceita, o telefone passa');
select pg_temp.ok((select phone from public.conversation_contact('20000000-0000-0000-0000-000000000001')) = '', 'contato liberado (telefone do Rafael ainda vazio)');
reset role; update public.bookings set status = 'confirmed';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok(public.pickup_address('30000000-0000-0000-0000-000000000001') = 'Rua Oscar Freire, 300', 'depois do pagamento, Rider recebe o endereço');

-- Arquivos
insert into storage.objects (bucket_id, name) values ('identity-documents', '00000000-0000-0000-0000-00000000000b/frente.jpg');
do $$ begin insert into storage.objects (bucket_id, name) values ('identity-documents', '00000000-0000-0000-0000-00000000000a/frente.jpg'); raise exception 'FALHOU: gravou na pasta de outra pessoa';
  exception when insufficient_privilege then raise notice 'OK  cada pessoa só grava na própria pasta'; end $$;
select pg_temp.ok((select count(*) from storage.objects where bucket_id = 'identity-documents') = 0, 'a própria pessoa não relê documentos (só a equipe)');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from storage.objects where bucket_id = 'identity-documents') = 1, 'equipe lê documentos');
select pg_temp.ok((select count(*) from public.profile_private) = 3, 'equipe vê os cadastros');

-- Notificações
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin insert into public.notifications (user_id, kind, href) values (auth.uid(), 'newMessage', '/'); raise exception 'FALHOU: criou aviso falso';
  exception when insufficient_privilege then raise notice 'OK  ninguém cria aviso falso'; end $$;
reset role;
select 'TODOS OS TESTES PASSARAM' as resultado;
