-- =============================================================================
-- Mundo Scoot · Tamanhos nos produtos da loja (decisão de 21/10/2026)
-- -----------------------------------------------------------------------------
-- Ex.: camiseta em P, M, G, GG e XXG. Quem compra escolhe o tamanho; o estoque
-- continua um só para o produto (não é dividido por tamanho). Se um tamanho
-- acabar, a equipe tira ele da lista no painel.
-- =============================================================================

alter table public.world_products
  add column sizes text[] not null default '{}'
    check (cardinality(sizes) <= 10 and array_position(sizes, null) is null);

-- Tamanho escolhido, guardado no item do pedido (vazio para produto sem tamanho).
alter table public.world_order_items
  add column size text check (size is null or char_length(size) between 1 and 10);

/**
 * Cria o pedido e separa o estoque (só o servidor do site chama).
 * p_items: [{"product_id": "...", "quantity": 2, "size": "M"}, ...]
 * Produto com tamanhos exige um tamanho da lista; produto sem tamanhos, nenhum.
 */
create or replace function public.create_world_order(p_items jsonb, p_buyer jsonb, p_buyer_id uuid default null)
returns table (id uuid, code text, access_token text, total numeric)
language plpgsql security definer set search_path = '' as $$
declare
  item record;
  line record;
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
  --    unidade) e confere estoque, preço e tamanhos.
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
    for line in
      select nullif(btrim(coalesce(e ->> 'size', '')), '') as size, (e ->> 'quantity')::integer as quantity
      from jsonb_array_elements(p_items) e where (e ->> 'product_id')::uuid = item.product_id
    loop
      if line.quantity is null or line.quantity < 1 then raise exception 'invalid_items'; end if;
      if cardinality(prod.sizes) > 0 and (line.size is null or not line.size = any (prod.sizes)) then
        raise exception 'size_required';
      end if;
      if cardinality(prod.sizes) = 0 and line.size is not null then raise exception 'invalid_items'; end if;
    end loop;
    sub := sub + prod.price * item.quantity;
  end loop;

  -- 2) Cria o pedido.
  insert into public.world_orders (buyer_id, buyer_name, buyer_email, buyer_phone, buyer_cpf, cep, street, number,
                                   complement, district, city, state, subtotal, shipping, total)
  values (p_buyer_id, btrim(p_buyer ->> 'name'), lower(btrim(p_buyer ->> 'email')), p_buyer ->> 'phone', p_buyer ->> 'cpf',
          p_buyer ->> 'cep', btrim(p_buyer ->> 'street'), btrim(p_buyer ->> 'number'), btrim(coalesce(p_buyer ->> 'complement', '')),
          btrim(p_buyer ->> 'district'), btrim(p_buyer ->> 'city'), upper(btrim(p_buyer ->> 'state')), sub, ship, sub + ship)
  returning * into o;

  -- 3) Separa o estoque e guarda os itens (um por tamanho) com nome e preço da hora da compra.
  for item in
    select (e ->> 'product_id')::uuid as product_id, sum((e ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items) e group by 1 order by 1
  loop
    update public.world_products set stock = stock - item.quantity where world_products.id = item.product_id
      returning * into prod;
    insert into public.world_order_items (order_id, product_id, name, price, quantity, size)
      select o.id, prod.id, prod.name, prod.price, sum((e ->> 'quantity')::integer)::integer,
             nullif(btrim(coalesce(e ->> 'size', '')), '')
      from jsonb_array_elements(p_items) e
      where (e ->> 'product_id')::uuid = item.product_id
      group by nullif(btrim(coalesce(e ->> 'size', '')), '');
  end loop;

  return query select o.id, o.code, o.access_token, sub + ship;
end;
$$;

revoke execute on function public.create_world_order(jsonb, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.create_world_order(jsonb, jsonb, uuid) to service_role;
