-- =============================================================================
-- Mundo Scoot (decisões de 19/10/2026)
-- -----------------------------------------------------------------------------
-- Aba aberta a todas as pessoas, com ou sem cadastro:
-- - Loja interna: produtos Hi Scoot (por enquanto só vitrine; a compra pelo
--   site ainda vai ser decidida).
-- - HiTV: vídeos do YouTube.
-- - Lojas parceiras e oficinas credenciadas (campos básicos; desconto,
--   horário e WhatsApp ficam para depois).
-- Qualquer pessoa vê o que está ativo. Só a equipe cria, muda e apaga.
-- =============================================================================

create table public.world_products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  description text not null default '' check (char_length(description) <= 1000),
  price numeric(10, 2) not null check (price > 0 and price <= 100000),
  photo_path text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.world_videos (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 2 and 100),
  -- Só o código do vídeo no YouTube (11 caracteres), nunca um endereço inteiro.
  youtube_id text not null unique check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.world_places (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('partner', 'workshop')),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  address text not null check (char_length(btrim(address)) between 5 and 200),
  city text not null check (char_length(btrim(city)) between 2 and 80),
  phone text check (phone is null or phone ~ '^[0-9]{10,11}$'),
  services text not null default '' check (char_length(services) <= 300),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((latitude is null) = (longitude is null))
);

alter table public.world_products enable row level security;
alter table public.world_videos enable row level security;
alter table public.world_places enable row level security;

create policy "Loja Mundo Scoot: todos veem os ativos; a equipe vê todos"
  on public.world_products for select to anon, authenticated
  using (active or public.is_admin());
create policy "Loja Mundo Scoot: só a equipe cria" on public.world_products
  for insert to authenticated with check (public.is_admin());
create policy "Loja Mundo Scoot: só a equipe muda" on public.world_products
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Loja Mundo Scoot: só a equipe apaga" on public.world_products
  for delete to authenticated using (public.is_admin());

create policy "HiTV: todos veem os ativos; a equipe vê todos"
  on public.world_videos for select to anon, authenticated
  using (active or public.is_admin());
create policy "HiTV: só a equipe cria" on public.world_videos
  for insert to authenticated with check (public.is_admin());
create policy "HiTV: só a equipe muda" on public.world_videos
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "HiTV: só a equipe apaga" on public.world_videos
  for delete to authenticated using (public.is_admin());

create policy "Parceiros e oficinas: todos veem os ativos; a equipe vê todos"
  on public.world_places for select to anon, authenticated
  using (active or public.is_admin());
create policy "Parceiros e oficinas: só a equipe cria" on public.world_places
  for insert to authenticated with check (public.is_admin());
create policy "Parceiros e oficinas: só a equipe muda" on public.world_places
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Parceiros e oficinas: só a equipe apaga" on public.world_places
  for delete to authenticated using (public.is_admin());

-- Visitantes sem conta só leem.
revoke insert, update, delete on public.world_products, public.world_videos, public.world_places from anon;

-- Fotos dos produtos: públicas para ver; só a equipe envia e apaga.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('world-photos', 'world-photos', true, 10485760,
   array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Fotos do Mundo Scoot: qualquer pessoa vê"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'world-photos');
create policy "Fotos do Mundo Scoot: só a equipe envia"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'world-photos' and public.is_admin());
create policy "Fotos do Mundo Scoot: só a equipe apaga"
  on storage.objects for delete to authenticated
  using (bucket_id = 'world-photos' and public.is_admin());
