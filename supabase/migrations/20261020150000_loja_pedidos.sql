-- =============================================================================
-- Mundo Scoot · Compra na Loja interna (decisões de 20/10/2026)
-- -----------------------------------------------------------------------------
-- - Estoque: a equipe informa a quantidade ao cadastrar o produto (itens
--   limitados, por temporada). Sem estoque, aparece "Esgotado".
-- - Frete: valor fixo por região (estado, ou cidade dentro do estado),
--   cadastrado pela equipe. Sem frete grátis. Cálculo automático fica para depois.
-- - Qualquer pessoa compra, com ou sem conta, e paga por PIX. O dinheiro cai
--   na conta Mercado Pago da Hi Scoot.
-- - O estoque fica separado enquanto o PIX espera (30 minutos). PIX vencido
--   devolve o estoque sozinho.
--
-- Comprador sem conta não lê nada direto do banco: o servidor do site (chave
-- secreta) cria o pedido e mostra a página dele só com o link secreto.
-- =============================================================================

alter table public.world_products
  add column stock integer not null default 0 check (stock >= 0 and stock <= 100000);

-- Frete por região ------------------------------------------------------------
create table public.world_shipping_rates (
  id uuid primary key default gen_random_uuid(),
  state text not null check (state ~ '^[A-Z]{2}$'),
  -- Vazio: vale para o estado todo. Preenchido: só para aquela cidade.
  city text check (city is null or char_length(btrim(city)) between 2 and 80),
  price numeric(10, 2) not null check (price > 0 and price <= 10000),
  created_at timestamptz not null default now()
);
create unique index world_shipping_rates_region on public.world_shipping_rates (state, lower(btrim(coalesce(city, ''))));

alter table public.world_shipping_rates enable row level security;
create policy "Frete: todos veem" on public.world_shipping_rates
  for select to anon, authenticated using (true);
create policy "Frete: só a equipe cria" on public.world_shipping_rates
  for insert to authenticated with check (public.is_admin());
create policy "Frete: só a equipe muda" on public.world_shipping_rates
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Frete: só a equipe apaga" on public.world_shipping_rates
  for delete to authenticated using (public.is_admin());
revoke insert, update, delete on public.world_shipping_rates from anon;

/** Valor do frete: primeiro a cidade, depois o estado todo. Sem região cadastrada: null. */
create or replace function public.shipping_price(p_state text, p_city text)
returns numeric language sql stable security definer set search_path = '' as $$
  select r.price from public.world_shipping_rates r
  where r.state = upper(btrim(p_state))
    and (r.city is null or lower(btrim(r.city)) = lower(btrim(coalesce(p_city, ''))))
  order by r.city is null
  limit 1
$$;

-- Pedidos ---------------------------------------------------------------------
create table public.world_orders (
  id uuid primary key default gen_random_uuid(),
  -- Número que a pessoa e a equipe usam para falar do pedido (ex.: HS3F9A2C).
  code text not null unique default ('HS' || upper(substr(md5(gen_random_uuid()::text), 1, 6))),
  -- Segredo do link do pedido (quem compra sem conta acompanha por ele).
  access_token text not null default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  buyer_id uuid references public.profiles (id) on delete set null,
  buyer_name text not null check (char_length(btrim(buyer_name)) between 3 and 120),
  buyer_email text not null check (buyer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(buyer_email) <= 200),
  buyer_phone text not null check (buyer_phone ~ '^[0-9]{10,11}$'),
  buyer_cpf text not null check (buyer_cpf ~ '^[0-9]{11}$'),
  cep text not null check (cep ~ '^[0-9]{8}$'),
  street text not null check (char_length(btrim(street)) between 2 and 150),
  number text not null check (char_length(btrim(number)) between 1 and 20),
  complement text not null default '' check (char_length(complement) <= 80),
  district text not null check (char_length(btrim(district)) between 2 and 80),
  city text not null check (char_length(btrim(city)) between 2 and 80),
  state text not null check (state ~ '^[A-Z]{2}$'),
  subtotal numeric(10, 2) not null check (subtotal > 0),
  shipping numeric(10, 2) not null check (shipping > 0),
  total numeric(10, 2) not null check (total = subtotal + shipping),
  -- pending: esperando o PIX · paid: pago · shipped: enviado · canceled: PIX vencido · refunded: devolvido pela equipe
  status text not null default 'pending' check (status in ('pending', 'paid', 'shipped', 'canceled', 'refunded')),
  status_reason text check (status_reason is null or char_length(status_reason) <= 200),
  tracking_code text check (tracking_code is null or char_length(btrim(tracking_code)) between 3 and 60),
  mp_payment_id text unique,
  pix_code text,
  pix_qr_base64 text,
  expires_at timestamptz not null default now() + interval '30 minutes',
  paid_at timestamptz,
  shipped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index world_orders_status on public.world_orders (status, created_at desc);

create table public.world_order_items (
  order_id uuid not null references public.world_orders (id) on delete cascade,
  product_id uuid references public.world_products (id) on delete set null,
  -- Nome e preço como estavam na hora da compra.
  name text not null,
  price numeric(10, 2) not null check (price > 0),
  quantity integer not null check (quantity between 1 and 10),
  id bigint generated always as identity primary key
);
create index world_order_items_order on public.world_order_items (order_id);

alter table public.world_orders enable row level security;
alter table public.world_order_items enable row level security;
-- Dado pessoal (CPF, endereço): só a equipe lê pelo painel. O comprador vê pelo servidor.
create policy "Pedidos: só a equipe" on public.world_orders
  for select to authenticated using (public.is_admin());
create policy "Itens do pedido: só a equipe" on public.world_order_items
  for select to authenticated using (public.is_admin());
revoke all on public.world_orders, public.world_order_items from anon, authenticated;
grant select on public.world_orders, public.world_order_items to authenticated;

/** Devolve ao estoque os itens de um pedido. */
create or replace function public.world_order_restock(p_order uuid)
returns void language sql security definer set search_path = '' as $$
  update public.world_products p set stock = p.stock + i.quantity
  from public.world_order_items i
  where i.order_id = p_order and i.product_id = p.id
$$;

/**
 * Cria o pedido e separa o estoque (só o servidor do site chama).
 * p_items: [{"product_id": "...", "quantity": 2}, ...]
 * p_buyer: nome, e-mail, telefone, CPF e endereço de entrega.
 */
create or replace function public.create_world_order(p_items jsonb, p_buyer jsonb, p_buyer_id uuid default null)
returns table (id uuid, code text, access_token text, total numeric)
language plpgsql security definer set search_path = '' as $$
declare
  item record;
  prod public.world_products;
  sub numeric := 0;
  ship numeric;
  o public.world_orders;
  lines integer;
begin
  if jsonb_typeof(p_items) <> 'array' then raise exception 'invalid_items'; end if;
  select count(*) into lines from jsonb_array_elements(p_items);
  if lines < 1 or lines > 10 then raise exception 'invalid_items'; end if;

  ship := public.shipping_price(p_buyer ->> 'state', p_buyer ->> 'city');
  if ship is null then raise exception 'no_shipping'; end if;

  -- 1) Trava os produtos em ordem (dois pedidos ao mesmo tempo não vendem a mesma
  --    unidade) e confere estoque e preço.
  for item in
    select (e ->> 'product_id')::uuid as product_id, sum((e ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items) e group by 1 order by 1
  loop
    if item.product_id is null or item.quantity is null or item.quantity < 1 or item.quantity > 10 then
      raise exception 'invalid_items';
    end if;
    select * into prod from public.world_products where world_products.id = item.product_id for update;
    if prod.id is null or not prod.active then raise exception 'unavailable'; end if;
    if prod.stock < item.quantity then raise exception 'out_of_stock'; end if;
    sub := sub + prod.price * item.quantity;
  end loop;

  -- 2) Cria o pedido.
  insert into public.world_orders (buyer_id, buyer_name, buyer_email, buyer_phone, buyer_cpf, cep, street, number,
                                   complement, district, city, state, subtotal, shipping, total)
  values (p_buyer_id, btrim(p_buyer ->> 'name'), lower(btrim(p_buyer ->> 'email')), p_buyer ->> 'phone', p_buyer ->> 'cpf',
          p_buyer ->> 'cep', btrim(p_buyer ->> 'street'), btrim(p_buyer ->> 'number'), btrim(coalesce(p_buyer ->> 'complement', '')),
          btrim(p_buyer ->> 'district'), btrim(p_buyer ->> 'city'), upper(btrim(p_buyer ->> 'state')), sub, ship, sub + ship)
  returning * into o;

  -- 3) Separa o estoque e guarda os itens com nome e preço da hora da compra.
  for item in
    select (e ->> 'product_id')::uuid as product_id, sum((e ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items) e group by 1 order by 1
  loop
    update public.world_products set stock = stock - item.quantity where world_products.id = item.product_id
      returning * into prod;
    insert into public.world_order_items (order_id, product_id, name, price, quantity)
      values (o.id, prod.id, prod.name, prod.price, item.quantity);
  end loop;

  return query select o.id, o.code, o.access_token, sub + ship;
end;
$$;

/** PIX pago (o servidor confere com o Mercado Pago antes). Confirma uma vez só. */
create or replace function public.confirm_world_order(p_order uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare o public.world_orders;
begin
  select * into o from public.world_orders where id = p_order for update;
  if o.id is null then raise exception 'not_found'; end if;
  if o.status = 'pending' then
    update public.world_orders set status = 'paid', paid_at = now(), updated_at = now() where id = p_order;
  elsif o.status = 'canceled' then
    -- Pagou bem na hora em que o PIX venceu: separa o estoque de novo (o que der) e avisa a equipe.
    update public.world_products p set stock = greatest(p.stock - i.quantity, 0)
      from public.world_order_items i where i.order_id = p_order and i.product_id = p.id;
    update public.world_orders set status = 'paid', paid_at = now(), updated_at = now(),
      status_reason = 'Pago depois do vencimento do PIX: conferir o estoque.' where id = p_order;
  end if;
  return (select status from public.world_orders where id = p_order);
end;
$$;

/** PIX vencido: cancela e devolve o estoque (roda sozinho a cada 5 minutos). */
create or replace function public.expire_world_orders()
returns integer language plpgsql security definer set search_path = '' as $$
declare o record; n integer := 0;
begin
  for o in
    select id from public.world_orders
    where status = 'pending' and expires_at < now() - interval '5 minutes'
    for update skip locked
  loop
    update public.world_orders set status = 'canceled', status_reason = 'PIX vencido.', updated_at = now() where id = o.id;
    perform public.world_order_restock(o.id);
    n := n + 1;
  end loop;
  return n;
end;
$$;

/** Equipe: pedido pago foi despachado, com o código de rastreio. */
create or replace function public.ship_world_order(p_order uuid, p_tracking text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  if p_tracking is null or char_length(btrim(p_tracking)) not between 3 and 60 then raise exception 'tracking_invalid'; end if;
  update public.world_orders set status = 'shipped', tracking_code = btrim(p_tracking), shipped_at = now(), updated_at = now()
    where id = p_order and status = 'paid';
  if not found then raise exception 'not_allowed'; end if;
end;
$$;

/** Equipe: o dinheiro já foi devolvido pelo Mercado Pago; registra e devolve o estoque. */
create or replace function public.refund_world_order(p_order uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_allowed'; end if;
  if p_reason is null or char_length(btrim(p_reason)) < 5 then raise exception 'reason_required'; end if;
  if char_length(btrim(p_reason)) > 200 then raise exception 'reason_too_long'; end if;
  update public.world_orders set status = 'refunded', status_reason = btrim(p_reason), updated_at = now()
    where id = p_order and status = 'paid';
  if not found then raise exception 'not_allowed'; end if;
  perform public.world_order_restock(p_order);
end;
$$;

revoke execute on function public.world_order_restock(uuid) from public, anon, authenticated;
revoke execute on function public.create_world_order(jsonb, jsonb, uuid) from public, anon, authenticated;
revoke execute on function public.confirm_world_order(uuid) from public, anon, authenticated;
revoke execute on function public.expire_world_orders() from public, anon, authenticated;
revoke execute on function public.ship_world_order(uuid, text) from public, anon;
revoke execute on function public.refund_world_order(uuid, text) from public, anon;
grant execute on function public.create_world_order(jsonb, jsonb, uuid) to service_role;
grant execute on function public.confirm_world_order(uuid) to service_role;
grant execute on function public.expire_world_orders() to service_role;
grant execute on function public.ship_world_order(uuid, text) to authenticated;
grant execute on function public.refund_world_order(uuid, text) to authenticated;
grant execute on function public.shipping_price(text, text) to anon, authenticated, service_role;

-- PIX vencido a cada 5 minutos, se o agendador do banco (pg_cron) existir.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      perform cron.schedule('loja-pix-vencido', '*/5 * * * *', 'select public.expire_world_orders()');
    exception when others then
      raise notice 'PIX vencido da loja não agendado: %', sqlerrm;
    end;
  end if;
end;
$$;
