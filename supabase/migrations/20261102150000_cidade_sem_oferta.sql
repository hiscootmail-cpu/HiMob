-- =============================================================================
-- Cidade sem oferta (decisão de 22/10/2026)
-- -----------------------------------------------------------------------------
-- - Quem busca uma cidade sem equipamento pode pedir "Avisar quando tiver".
--   Quando um anúncio for publicado ali, essas pessoas recebem um aviso.
-- - Cada pedido numa cidade sem oferta avisa todas as pessoas cadastradas:
--   "Demanda por Hosts em [cidade] - [UF]: cadastre seu equipamento e faça
--   renda extra". No máximo uma vez por cidade a cada 7 dias (para não virar
--   excesso de avisos).
-- =============================================================================

create table public.city_alerts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  city_key text not null,
  city text not null check (char_length(btrim(city)) between 1 and 60),
  city_state text not null check (city_state ~ '^[A-Z]{2}$'),
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  primary key (user_id, city_key)
);
alter table public.city_alerts enable row level security;
create policy "Avisos de cidade: a pessoa vê os seus; a equipe vê todos" on public.city_alerts
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "Avisos de cidade: a pessoa apaga os seus" on public.city_alerts
  for delete to authenticated using (user_id = auth.uid());
revoke insert, update on public.city_alerts from anon, authenticated;

-- Última vez que o aviso "Demanda por Hosts" saiu para cada cidade.
create table public.host_demand_broadcasts (
  city_key text primary key,
  sent_at timestamptz not null default now()
);
alter table public.host_demand_broadcasts enable row level security;
create policy "Demanda por Hosts: só a equipe vê" on public.host_demand_broadcasts
  for select to authenticated using (public.is_admin());
revoke all on public.host_demand_broadcasts from anon, authenticated;
grant select on public.host_demand_broadcasts to authenticated;

/**
 * "Avisar quando tiver nesta cidade". Devolve 'saved'. Se a cidade não tem
 * equipamento publicado, avisa todas as pessoas cadastradas da demanda por Hosts
 * (no máximo uma vez a cada 7 dias por cidade).
 */
create or replace function public.request_city_alert(p_city text, p_uf text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  v_city text := btrim(coalesce(p_city, ''));
  v_uf text := upper(btrim(coalesce(p_uf, '')));
  v_key text := public.city_key(p_city);
  label text;
begin
  if me is null or not exists (select 1 from public.profiles where id = me and deleted_at is null) then
    raise exception 'not_allowed';
  end if;
  if char_length(v_city) not between 1 and 60 or public.br_state_name(v_uf) is null then
    raise exception 'city_invalid';
  end if;
  insert into public.city_alerts (user_id, city_key, city, city_state)
    values (me, v_key, v_city, v_uf)
    on conflict (user_id, city_key) do update set created_at = now(), notified_at = null;
  insert into public.city_regions (city_key, city, state, state_code, country)
    values (v_key, v_city, public.br_state_name(v_uf), v_uf, 'BR')
    on conflict (city_key) do nothing;

  if not exists (select 1 from public.equipment e
                  where e.review_status = 'approved' and e.is_available and public.city_key(e.city) = v_key)
     and not exists (select 1 from public.host_demand_broadcasts b
                      where b.city_key = v_key and b.sent_at > now() - interval '7 days') then
    insert into public.host_demand_broadcasts (city_key, sent_at) values (v_key, now())
      on conflict (city_key) do update set sent_at = now();
    label := v_city || ' - ' || v_uf;
    insert into public.notifications (user_id, kind, href, name, needs_action)
      select p.id, 'hostDemand', '/host/equipment/new', label, false
      from public.profiles p where p.deleted_at is null;
  end if;
  return 'saved';
end;
$$;
revoke execute on function public.request_city_alert(text, text) from public, anon;
grant execute on function public.request_city_alert(text, text) to authenticated;

/** Anúncio publicado: avisa quem pediu aviso naquela cidade. */
create or replace function public.notify_city_alerts()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.review_status = 'approved' and new.is_available
     and (tg_op = 'INSERT' or old.review_status is distinct from 'approved' or old.is_available is distinct from true) then
    insert into public.notifications (user_id, kind, href, name, title, needs_action)
      select a.user_id, 'cityAvailable', '/equipment/' || new.id, a.city || ' - ' || a.city_state, new.title, false
      from public.city_alerts a
      where a.city_key = public.city_key(new.city) and a.notified_at is null and a.user_id <> new.host_id;
    update public.city_alerts set notified_at = now()
      where city_key = public.city_key(new.city) and notified_at is null and user_id <> new.host_id;
  end if;
  return new;
end;
$$;
create trigger equipment_notify_city_alerts after insert or update of review_status, is_available on public.equipment
  for each row execute function public.notify_city_alerts();
revoke execute on function public.notify_city_alerts() from public, anon, authenticated;
