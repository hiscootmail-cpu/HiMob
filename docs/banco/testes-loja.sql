\set ON_ERROR_STOP 1
-- Loja do Mundo Scoot: estoque, frete por região, pedido com PIX, envio e devolução. Num banco novo, depois de todas as migrações.
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
create or replace function pg_temp.as_server() returns void language plpgsql as $$
begin perform set_config('role', 'service_role', false); perform set_config('request.jwt.claim.sub', '', false); end $$;

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a', 'rafael@exemplo.com', '{"full_name":"Rafael Santos","phone":"11955550101"}'),
 ('00000000-0000-0000-0000-00000000000c', 'equipe@hiscoot.com.br', '{"full_name":"Equipe Hi Scoot"}');
update public.profile_private set is_admin = true where id = '00000000-0000-0000-0000-00000000000c';

-- A equipe cadastra produtos com estoque e o frete por região
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into public.world_products (id, name, price, stock) values
  ('50000000-0000-0000-0000-000000000001', 'Capacete', 100, 3),
  ('50000000-0000-0000-0000-000000000002', 'Luva', 50, 1);
insert into public.world_shipping_rates (state, city, price) values ('SP', null, 25), ('SP', 'Campinas', 15);
select pg_temp.fails($$insert into public.world_shipping_rates (state, city, price) values ('SP', ' campinas ', 20)$$, '23505', 'Frete: uma região só uma vez');
select pg_temp.fails($$insert into public.world_shipping_rates (state, price) values ('RJ', 0)$$, '23514', 'Frete: sem frete grátis');
select pg_temp.fails($$update public.world_products set stock = -1 where name = 'Luva'$$, '23514', 'Estoque não fica negativo');

-- Visitante: vê o frete, não cria pedido nem lê pedidos
select pg_temp.as_user(null);
select pg_temp.ok(public.shipping_price('sp', 'CAMPINAS') = 15, 'Frete da cidade vale primeiro');
select pg_temp.ok(public.shipping_price('SP', 'Santos') = 25, 'Outra cidade usa o frete do estado');
select pg_temp.ok(public.shipping_price('MG', 'BH') is null, 'Estado sem frete cadastrado: não entrega');
select pg_temp.fails($$select * from public.create_world_order('[]', '{}')$$, '42501', 'Visitante não cria pedido direto no banco');
select pg_temp.fails($$select * from public.world_orders$$, '42501', 'Visitante não lê pedidos');

-- O servidor cria o pedido (comprador sem conta)
select pg_temp.as_server();
create temp table buyer as select '{"name":"Maria Souza","email":"Maria@Exemplo.com","phone":"19999990000","cpf":"12345678909","cep":"13010000","street":"Rua A","number":"10","complement":"","district":"Centro","city":"Campinas","state":"SP"}'::jsonb as b;
create temp table o1 as select * from public.create_world_order('[{"product_id":"50000000-0000-0000-0000-000000000001","quantity":2},{"product_id":"50000000-0000-0000-0000-000000000002","quantity":1}]', (select b from buyer));
select pg_temp.ok((select total from o1) = 265, 'Total = 2 x 100 + 50 + frete 15');
select pg_temp.ok((select code from o1) ~ '^HS[0-9A-F]{6}$', 'Pedido ganha número HS...');
select pg_temp.ok(length((select access_token from o1)) = 64, 'Pedido ganha link secreto');
select pg_temp.ok((select stock from public.world_products where name = 'Capacete') = 1 and (select stock from public.world_products where name = 'Luva') = 0, 'Estoque separado na hora do pedido');
select pg_temp.ok((select buyer_email from public.world_orders) = 'maria@exemplo.com', 'E-mail guardado em minúsculas');
select pg_temp.fails($$select * from public.create_world_order('[{"product_id":"50000000-0000-0000-0000-000000000002","quantity":1}]', (select b from buyer))$$, 'out_of_stock', 'Sem estoque: não vende');
select pg_temp.fails($$select * from public.create_world_order('[{"product_id":"50000000-0000-0000-0000-000000000001","quantity":1}]', (select b || '{"state":"MG"}' from buyer))$$, 'no_shipping', 'Região sem frete: não vende');
select pg_temp.fails($$select * from public.create_world_order('[{"product_id":"50000000-0000-0000-0000-000000000001","quantity":1}]', (select b || '{"cpf":"123"}' from buyer))$$, '23514', 'CPF inválido: não cria');
select pg_temp.ok((select stock from public.world_products where name = 'Capacete') = 1, 'Pedido que falhou não mexe no estoque');
select pg_temp.fails($$select * from public.create_world_order('[{"product_id":"50000000-0000-0000-0000-000000000001","quantity":11}]', (select b from buyer))$$, 'invalid_items', 'No máximo 10 de cada item');

-- PIX pago
select pg_temp.ok(public.confirm_world_order((select id from o1)) = 'paid', 'PIX pago: pedido pago');
select pg_temp.ok(public.confirm_world_order((select id from o1)) = 'paid', 'Confirmar de novo não muda nada');

-- PIX vencido devolve o estoque
create temp table o2 as select * from public.create_world_order('[{"product_id":"50000000-0000-0000-0000-000000000001","quantity":1}]', (select b from buyer));
select pg_temp.ok((select stock from public.world_products where name = 'Capacete') = 0, 'Segundo pedido separa a última unidade');
update public.world_orders set expires_at = now() - interval '10 minutes' where id = (select id from o2);
select pg_temp.ok(public.expire_world_orders() = 1, 'PIX vencido é cancelado');
select pg_temp.ok((select stock from public.world_products where name = 'Capacete') = 1, 'Estoque volta quando o PIX vence');
select pg_temp.ok(public.confirm_world_order((select id from o2)) = 'paid', 'Pago bem no vencimento: vira pago');
select pg_temp.ok((select stock from public.world_products where name = 'Capacete') = 0, 'Pago bem no vencimento: separa o estoque de novo');

grant select on o1, o2 to authenticated;

-- Pessoa com conta (não é da equipe) não mexe nos pedidos
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.ok((select count(*) from public.world_orders) = 0, 'Pessoa com conta não vê pedidos dos outros');
select pg_temp.fails($$select public.ship_world_order((select id from o1), 'BR123')$$, 'not_allowed', 'Só a equipe marca como enviado');
select pg_temp.fails($$select public.confirm_world_order((select id from o1))$$, '42501', 'Ninguém confirma PIX pelo site');

-- A equipe envia e devolve
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from public.world_orders) = 2, 'Equipe vê os pedidos');
select pg_temp.ok((select count(*) from public.world_order_items) = 3, 'Equipe vê os itens');
select public.ship_world_order((select id from o1), 'BR123456789');
select pg_temp.ok((select status from public.world_orders where id = (select id from o1)) = 'shipped', 'Pedido enviado com rastreio');
select pg_temp.fails($$select public.refund_world_order((select id from o1), 'Desistiu da compra')$$, 'not_allowed', 'Pedido enviado não é devolvido pelo site');
select pg_temp.fails($$select public.refund_world_order((select id from o2), 'Nao')$$, 'reason_required', 'Devolver pede motivo');
select public.refund_world_order((select id from o2), 'Pessoa desistiu da compra');
select pg_temp.ok((select status from public.world_orders where id = (select id from o2)) = 'refunded' and (select stock from public.world_products where name = 'Capacete') = 1, 'Devolvido: estoque volta');
select pg_temp.fails($$update public.world_orders set total = 1$$, '42501', 'Nem a equipe muda valores do pedido direto');
reset role;
\echo 'Loja: todos os testes passaram'
