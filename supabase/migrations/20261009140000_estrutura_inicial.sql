-- =============================================================================
-- Hi Scoot · Etapa 1 do banco: tabelas, regras de segurança e pastas de arquivos
-- =============================================================================
-- Regra de ouro: quem protege os dados é o BANCO (Row Level Security), não a
-- tela. Esconder um botão não protege nada; cada tabela abaixo diz quem pode
-- ver e mexer em cada linha.
--
-- O que é público fica numa tabela; o que é privado fica numa tabela "_private"
-- ao lado, que só o dono e a equipe leem:
--   profiles        → nome curto, cidade, selos           (público)
--   profile_private → nome completo, telefone, recusas     (dono e equipe)
--   equipment       → anúncio aprovado, região aproximada  (público)
--   equipment_private → endereço exato, ponto exato, código da etiqueta QR
--
-- Escritas sensíveis (reservar, aceitar, pagar, confirmar retirada, aprovar)
-- entram nas próximas etapas como funções do banco que conferem as regras.
-- =============================================================================

create extension if not exists btree_gist with schema extensions;

-- -----------------------------------------------------------------------------
-- Funções de apoio
-- -----------------------------------------------------------------------------

-- Nome mostrado para outras pessoas: primeiro nome + inicial ("Rafael S.").
create or replace function public.short_name(full_name text)
returns text language sql immutable as $$
  select case
    when array_length(regexp_split_to_array(trim(full_name), '\s+'), 1) > 1
      then split_part(trim(full_name), ' ', 1) || ' ' ||
           left((regexp_split_to_array(trim(full_name), '\s+'))[array_length(regexp_split_to_array(trim(full_name), '\s+'), 1)], 1) || '.'
    else trim(full_name)
  end
$$;

-- Telefone e e-mail no chat ficam ocultos até existir reserva aceita.
create or replace function public.redact_contacts(body text)
returns text language sql immutable as $$
  select regexp_replace(
    regexp_replace(body, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '•••', 'g'),
    '\+?\d([\s().-]*\d){7,}', '•••', 'g')
$$;

-- -----------------------------------------------------------------------------
-- Perfis
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  city text not null default '' check (char_length(city) <= 60),
  is_host boolean not null default false,
  host_since smallint,
  identity_status text not null default 'pending'
    check (identity_status in ('pending', 'rejected', 'blocked', 'approved')),
  created_at timestamptz not null default now()
);
comment on table public.profiles is 'Parte pública do perfil: nome curto, cidade e selos. Sem contato.';

create table public.profile_private (
  id uuid primary key references public.profiles (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  phone text not null default '' check (char_length(phone) <= 20),
  is_admin boolean not null default false,
  identity_rejections smallint not null default 0,
  identity_reason text
);
comment on table public.profile_private is 'Dados privados: só a própria pessoa e a equipe leem.';

-- É da equipe? (security definer: lê a tabela privada sem abrir a tabela para todos)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_admin from public.profile_private p where p.id = auth.uid()), false)
$$;

-- Cadastro novo: cria o perfil com o nome completo informado no cadastro.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  name text := coalesce(new.raw_user_meta_data ->> 'full_name', '');
begin
  insert into public.profiles (id, display_name) values (new.id, public.short_name(name));
  insert into public.profile_private (id, full_name) values (new.id, name);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Nome travado depois da identidade verificada (decisão de 09/10/2026) e
-- nome curto público sempre acompanhando o nome completo.
create or replace function public.guard_profile_private()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  -- Mudança feita pelo painel da Supabase ou pelo próprio sistema (sem pessoa conectada).
  system boolean := auth.uid() is null;
begin
  if new.full_name is distinct from old.full_name then
    if not system and not public.is_admin() and exists (
      select 1 from public.profiles p where p.id = new.id and p.identity_status = 'approved'
    ) then
      raise exception 'name_locked' using hint = 'Nome conferido com o documento: envie um documento novo para trocar.';
    end if;
    update public.profiles set display_name = public.short_name(new.full_name) where id = new.id;
  end if;
  if not system and not public.is_admin() and (new.is_admin is distinct from old.is_admin
      or new.identity_rejections is distinct from old.identity_rejections
      or new.identity_reason is distinct from old.identity_reason) then
    raise exception 'not_allowed';
  end if;
  return new;
end;
$$;

create trigger profile_private_guard
  before update on public.profile_private
  for each row execute function public.guard_profile_private();

-- "Quero ser Host": self-service, um clique (inventário de ações).
create or replace function public.become_host()
returns void language sql security definer set search_path = '' as $$
  update public.profiles
     set is_host = true,
         host_since = coalesce(host_since, extract(year from now())::smallint)
   where id = auth.uid() and identity_status <> 'blocked'
$$;

alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;

create policy "Perfis públicos: qualquer pessoa vê"
  on public.profiles for select using (true);
create policy "Perfil: a pessoa muda a própria cidade"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "Dados privados: só a pessoa e a equipe"
  on public.profile_private for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "Dados privados: a pessoa muda os próprios"
  on public.profile_private for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- Só estas colunas podem ser mudadas pela própria pessoa.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (city) on public.profiles to authenticated;
revoke insert, update, delete on public.profile_private from anon, authenticated;
revoke select on public.profile_private from anon;
grant update (full_name, phone) on public.profile_private to authenticated;

-- -----------------------------------------------------------------------------
-- Verificação de identidade
-- -----------------------------------------------------------------------------

create table public.identity_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('document', 'letter')),
  -- Caminhos na pasta privada "identity-documents" (frente/verso ou carta).
  front_path text,
  back_path text,
  letter_path text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reason text check (char_length(reason) <= 500),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (kind = 'document' and front_path is not null and back_path is not null)
    or (kind = 'letter' and letter_path is not null)
  )
);

alter table public.identity_submissions enable row level security;
create policy "Documento enviado: a pessoa e a equipe veem"
  on public.identity_submissions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "Envio de documento: a pessoa envia o próprio"
  on public.identity_submissions for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and reason is null and reviewed_by is null);
revoke update, delete on public.identity_submissions from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Equipamentos (anúncios)
-- -----------------------------------------------------------------------------

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('scooter', 'ebike')),
  title text not null check (char_length(title) between 1 and 60),
  description text not null check (char_length(description) between 1 and 1000),
  -- Preço por dia que o Host recebe, em reais (nunca por hora).
  daily_price numeric(6, 2) not null check (daily_price > 0 and daily_price <= 999),
  city text not null check (char_length(city) between 1 and 60),
  area text not null check (char_length(area) between 1 and 60),
  -- Região APROXIMADA (cerca de 1 km): o ponto exato fica em equipment_private.
  latitude double precision,
  longitude double precision,
  pickup_time time not null,
  return_time time not null,
  is_available boolean not null default true,
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected')),
  review_reason text check (char_length(review_reason) <= 500),
  last_sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index equipment_host_idx on public.equipment (host_id);
create index equipment_approved_idx on public.equipment (review_status) where review_status = 'approved';

create table public.equipment_private (
  equipment_id uuid primary key references public.equipment (id) on delete cascade,
  pickup_address text not null check (char_length(pickup_address) between 1 and 200),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  -- Código escrito embaixo do QR da etiqueta. Gerado pelo banco.
  label_code text not null unique default ('HS-' || lpad((floor(random() * 1000000))::int::text, 6, '0'))
);

-- A região pública acompanha o ponto exato, arredondada (cerca de 1 km).
create or replace function public.sync_public_location()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.equipment
     set latitude = round(new.latitude::numeric, 2)::double precision,
         longitude = round(new.longitude::numeric, 2)::double precision
   where id = new.equipment_id;
  return new;
end;
$$;
create trigger equipment_private_location
  after insert or update of latitude, longitude on public.equipment_private
  for each row execute function public.sync_public_location();

create table public.equipment_photos (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment (id) on delete cascade,
  -- Caminho na pasta pública "equipment-photos".
  path text not null,
  position smallint not null check (position between 0 and 9),
  unique (equipment_id, position)
);

-- Edição de anúncio publicado: vai para a análise; o anúncio antigo segue no ar.
create table public.equipment_edits (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment (id) on delete cascade,
  host_id uuid not null references public.profiles (id) on delete cascade,
  -- Valores novos propostos (mesmos nomes de campo do anúncio).
  changes jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reason text check (char_length(reason) <= 500),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index equipment_edits_one_pending on public.equipment_edits (equipment_id) where status = 'pending';

-- Dias bloqueados pelo Host (decisão de 09/10/2026).
create table public.blocked_days (
  equipment_id uuid not null references public.equipment (id) on delete cascade,
  day date not null,
  primary key (equipment_id, day)
);

-- "Avisar quando disponível".
create table public.waitlist (
  equipment_id uuid not null references public.equipment (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (equipment_id, user_id)
);

create or replace function public.owns_equipment(eq uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.equipment e where e.id = eq and e.host_id = auth.uid())
$$;

alter table public.equipment enable row level security;
alter table public.equipment_private enable row level security;
alter table public.equipment_photos enable row level security;
alter table public.equipment_edits enable row level security;
alter table public.blocked_days enable row level security;
alter table public.waitlist enable row level security;

create policy "Anúncios: aprovados para todos; Host e equipe veem os demais"
  on public.equipment for select
  using (review_status = 'approved' or host_id = auth.uid() or public.is_admin());
create policy "Anúncios: o Host cria (vai para análise)"
  on public.equipment for insert to authenticated
  with check (
    host_id = auth.uid() and review_status = 'pending' and review_reason is null
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_host and p.identity_status <> 'blocked')
  );
create policy "Anúncios: o Host marca disponível/indisponível"
  on public.equipment for update to authenticated
  using (host_id = auth.uid()) with check (host_id = auth.uid());
revoke insert, update, delete on public.equipment from anon, authenticated;
grant insert (id, host_id, type, title, description, daily_price, city, area, pickup_time, return_time) on public.equipment to authenticated;
grant update (is_available) on public.equipment to authenticated;

create policy "Dados privados do anúncio: Host e equipe"
  on public.equipment_private for select to authenticated
  using (public.owns_equipment(equipment_id) or public.is_admin());
create policy "Dados privados do anúncio: o Host cria"
  on public.equipment_private for insert to authenticated
  with check (public.owns_equipment(equipment_id));
revoke select, insert, update, delete on public.equipment_private from anon;
revoke insert, update, delete on public.equipment_private from authenticated;
grant insert (equipment_id, pickup_address, latitude, longitude) on public.equipment_private to authenticated;

create policy "Fotos: de anúncios visíveis"
  on public.equipment_photos for select
  using (exists (select 1 from public.equipment e where e.id = equipment_id));
create policy "Fotos: o Host adiciona e remove nas próprias"
  on public.equipment_photos for all to authenticated
  using (public.owns_equipment(equipment_id)) with check (public.owns_equipment(equipment_id));
revoke insert, update, delete on public.equipment_photos from anon;

create policy "Edições: o Host vê as próprias; a equipe vê todas"
  on public.equipment_edits for select to authenticated
  using (host_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.equipment_edits from anon, authenticated;

create policy "Dias bloqueados: o Host gerencia os próprios"
  on public.blocked_days for all to authenticated
  using (public.owns_equipment(equipment_id)) with check (public.owns_equipment(equipment_id) and day >= current_date);
revoke select, insert, update, delete on public.blocked_days from anon;

create policy "Lista de espera: só a própria pessoa"
  on public.waitlist for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke select, insert, update, delete on public.waitlist from anon;

-- -----------------------------------------------------------------------------
-- Reservas
-- -----------------------------------------------------------------------------

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment (id) on delete restrict,
  rider_id uuid not null references public.profiles (id) on delete restrict,
  host_id uuid not null references public.profiles (id) on delete restrict,
  start_date date not null,
  end_date date not null check (end_date > start_date),
  -- Valor do Host por dia e horários no momento da reserva.
  host_daily_price numeric(6, 2) not null check (host_daily_price > 0),
  pickup_time time not null,
  return_time time not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'confirmed', 'active', 'completed', 'rejected', 'cancelled')),
  cancelled_by text check (cancelled_by in ('rider', 'host')),
  rider_reviewed boolean not null default false,
  host_reviewed boolean not null default false,
  created_at timestamptz not null default now(),
  check (rider_id <> host_id),
  -- Dois aluguéis aceitos não podem ocupar o mesmo dia do mesmo equipamento.
  constraint bookings_no_overlap exclude using gist (
    equipment_id with =,
    daterange(start_date, end_date, '[]') with &&
  ) where (status in ('accepted', 'confirmed', 'active'))
);
create index bookings_rider_idx on public.bookings (rider_id);
create index bookings_host_idx on public.bookings (host_id);

-- Retirada e devolução: foto obrigatória (e o código da etiqueta, para o Rider).
create table public.handoffs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  kind text not null check (kind in ('pickup', 'return')),
  by_role text not null check (by_role in ('rider', 'host')),
  -- Caminho na pasta privada "handoff-photos".
  photo_path text not null,
  created_at timestamptz not null default now(),
  unique (booking_id, kind, by_role)
);

create or replace function public.in_booking(b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.bookings x where x.id = b and auth.uid() in (x.rider_id, x.host_id))
$$;

alter table public.bookings enable row level security;
alter table public.handoffs enable row level security;

create policy "Reservas: Rider, Host e equipe"
  on public.bookings for select to authenticated
  using (rider_id = auth.uid() or host_id = auth.uid() or public.is_admin());
-- Pedir, aceitar, pagar e cancelar entram na etapa 4 como funções que conferem as regras.
revoke insert, update, delete on public.bookings from anon, authenticated;
revoke select on public.bookings from anon;

create policy "Retirada/devolução: as duas pessoas da reserva e a equipe"
  on public.handoffs for select to authenticated
  using (public.in_booking(booking_id) or public.is_admin());
revoke insert, update, delete on public.handoffs from anon, authenticated;
revoke select on public.handoffs from anon;

-- Endereço exato: só para o Rider depois do pagamento (e para o Host).
create or replace function public.pickup_address(b uuid)
returns text language sql stable security definer set search_path = '' as $$
  select ep.pickup_address
    from public.bookings x
    join public.equipment_private ep on ep.equipment_id = x.equipment_id
   where x.id = b
     and (x.host_id = auth.uid()
          or (x.rider_id = auth.uid() and x.status in ('confirmed', 'active', 'completed')))
$$;

-- Dias fora da reserva: reservados (aceita, paga, em uso) + bloqueados pelo Host.
create or replace function public.unavailable_days(eq uuid)
returns table (day date) language sql stable security definer set search_path = '' as $$
  select d::date
    from public.bookings x,
         generate_series(x.start_date, x.end_date, interval '1 day') d
   where x.equipment_id = eq and x.status in ('accepted', 'confirmed', 'active') and d >= current_date
  union
  select b.day from public.blocked_days b where b.equipment_id = eq and b.day >= current_date
  order by 1
$$;

-- -----------------------------------------------------------------------------
-- Avaliações
-- -----------------------------------------------------------------------------

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  -- Quem foi avaliado: o Host (pelo Rider) ou o Rider (pelo Host).
  target_role text not null check (target_role in ('host', 'rider')),
  rating smallint not null check (rating between 1 and 5),
  -- Nota do equipamento: só quando o Rider avalia.
  equipment_rating smallint check (equipment_rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  unique (booking_id, author_id)
);

alter table public.reviews enable row level security;
create policy "Avaliações são públicas" on public.reviews for select using (true);
-- Avaliar entra na etapa 5 como função (só depois da devolução, uma vez por reserva).
revoke insert, update, delete on public.reviews from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Conversas
-- -----------------------------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment (id) on delete cascade,
  rider_id uuid not null references public.profiles (id) on delete cascade,
  host_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (equipment_id, rider_id),
  check (rider_id <> host_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

create or replace function public.in_conversation(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.conversations x where x.id = c and auth.uid() in (x.rider_id, x.host_id))
$$;

-- Existe reserva aceita entre as duas pessoas para aquele equipamento?
create or replace function public.contact_unlocked(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversations x
      join public.bookings b on b.equipment_id = x.equipment_id and b.rider_id = x.rider_id
     where x.id = c and b.status in ('accepted', 'confirmed', 'active', 'completed')
  )
$$;

-- Sem reserva aceita, o banco esconde telefone e e-mail ANTES de guardar.
create or replace function public.redact_message()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.contact_unlocked(new.conversation_id) then
    new.body := public.redact_contacts(new.body);
  end if;
  return new;
end;
$$;
create trigger messages_redact before insert on public.messages
  for each row execute function public.redact_message();

-- Contato da outra pessoa: só com reserva aceita.
create or replace function public.conversation_contact(c uuid)
returns table (phone text, email text) language sql stable security definer set search_path = '' as $$
  select pp.phone, u.email::text
    from public.conversations x
    join public.profile_private pp on pp.id = case when x.rider_id = auth.uid() then x.host_id else x.rider_id end
    join auth.users u on u.id = pp.id
   where x.id = c and auth.uid() in (x.rider_id, x.host_id) and public.contact_unlocked(c)
$$;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "Conversas: só as duas pessoas"
  on public.conversations for select to authenticated
  using (auth.uid() in (rider_id, host_id));
create policy "Conversas: o Rider começa sobre um anúncio aprovado"
  on public.conversations for insert to authenticated
  with check (
    rider_id = auth.uid()
    and exists (select 1 from public.equipment e where e.id = equipment_id and e.host_id = conversations.host_id and e.review_status = 'approved')
  );
revoke update, delete on public.conversations from anon, authenticated;
revoke select, insert on public.conversations from anon;

create policy "Mensagens: só as duas pessoas leem"
  on public.messages for select to authenticated
  using (public.in_conversation(conversation_id));
create policy "Mensagens: cada pessoa envia em nome próprio"
  on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.in_conversation(conversation_id) and read_at is null);
create policy "Mensagens: marcar como lida a mensagem recebida"
  on public.messages for update to authenticated
  using (public.in_conversation(conversation_id) and sender_id <> auth.uid());
revoke insert, update, delete on public.messages from anon, authenticated;
revoke select on public.messages from anon;
grant insert (conversation_id, sender_id, body) on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;

-- -----------------------------------------------------------------------------
-- Notificações (lista aprovada em 09/10/2026)
-- -----------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in (
    'bookingRequest', 'bookingAccepted', 'bookingRejected', 'paymentConfirmed', 'pickupReminder',
    'returnConfirmed', 'reviewReceived', 'listingApproved', 'listingRejected',
    'documentApproved', 'documentRejected', 'newMessage')),
  href text not null,
  name text,
  title text,
  needs_action boolean not null default false,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
create policy "Notificações: só a própria pessoa"
  on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "Notificações: marcar como lida"
  on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, update, delete on public.notifications from anon, authenticated;
revoke select on public.notifications from anon;
grant update (read) on public.notifications to authenticated;

-- -----------------------------------------------------------------------------
-- Pastas de arquivos (Storage)
-- -----------------------------------------------------------------------------
-- Cada pessoa grava só dentro da pasta com o próprio id: <id>/arquivo.jpg

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('identity-documents', 'identity-documents', false, 5242880,
   array['image/jpeg', 'image/png', 'application/pdf']),
  ('equipment-photos', 'equipment-photos', true, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('handoff-photos', 'handoff-photos', false, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

-- Documentos: dado sensível (LGPD). A pessoa envia o próprio; só a equipe lê.
create policy "Documentos: a pessoa envia na própria pasta"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'identity-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Documentos: só a equipe lê"
  on storage.objects for select to authenticated
  using (bucket_id = 'identity-documents' and public.is_admin());

-- Fotos dos anúncios: públicas para ver; o Host grava na própria pasta.
create policy "Fotos de anúncio: o Host envia na própria pasta"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'equipment-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Fotos de anúncio: o Host apaga as próprias"
  on storage.objects for delete to authenticated
  using (bucket_id = 'equipment-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Fotos de retirada/devolução: quem enviou e a equipe.
create policy "Fotos de retirada: a pessoa envia na própria pasta"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'handoff-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Fotos de retirada: quem enviou e a equipe"
  on storage.objects for select to authenticated
  using (bucket_id = 'handoff-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
