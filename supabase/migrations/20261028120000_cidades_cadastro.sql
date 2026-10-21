-- =============================================================================
-- Cidade onde mora e cidade secundária (decisão de 21/10/2026)
-- -----------------------------------------------------------------------------
-- Todo cadastro informa a cidade onde mora (obrigatória) e pode informar uma
-- cidade secundária (trabalho, estudo, fim de semana). A pessoa escolhe da
-- lista oficial de municípios do IBGE, então cada cidade vem com o estado (UF).
-- Quem já tem conta escolhe as cidades na próxima vez que entrar.
-- As cidades escolhidas entram na tabela de regiões (estado e país) usada no
-- Painel → Operação.
-- =============================================================================

alter table public.profiles
  add column city_state text check (city_state is null or city_state ~ '^[A-Z]{2}$'),
  add column second_city text check (second_city is null or char_length(btrim(second_city)) between 1 and 60),
  add column second_city_state text check (second_city_state is null or second_city_state ~ '^[A-Z]{2}$'),
  add check ((second_city is null) = (second_city_state is null));

/** Nome do estado pela sigla (Brasil). */
create or replace function public.br_state_name(p_uf text)
returns text language sql immutable set search_path = '' as $$
  select name from (values
    ('AC', 'Acre'), ('AL', 'Alagoas'), ('AM', 'Amazonas'), ('AP', 'Amapá'), ('BA', 'Bahia'), ('CE', 'Ceará'),
    ('DF', 'Distrito Federal'), ('ES', 'Espírito Santo'), ('GO', 'Goiás'), ('MA', 'Maranhão'), ('MG', 'Minas Gerais'),
    ('MS', 'Mato Grosso do Sul'), ('MT', 'Mato Grosso'), ('PA', 'Pará'), ('PB', 'Paraíba'), ('PE', 'Pernambuco'),
    ('PI', 'Piauí'), ('PR', 'Paraná'), ('RJ', 'Rio de Janeiro'), ('RN', 'Rio Grande do Norte'), ('RO', 'Rondônia'),
    ('RR', 'Roraima'), ('RS', 'Rio Grande do Sul'), ('SC', 'Santa Catarina'), ('SE', 'Sergipe'), ('SP', 'São Paulo'),
    ('TO', 'Tocantins')
  ) as s(uf, name) where uf = upper(btrim(coalesce(p_uf, '')))
$$;

/** Guarda estado e país das cidades escolhidas no cadastro (a primeira vez vale). */
create or replace function public.remember_profile_cities()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.city_state is not null and public.br_state_name(new.city_state) is not null and btrim(new.city) <> '' then
    insert into public.city_regions (city_key, city, state, state_code, country)
      values (public.city_key(new.city), btrim(new.city), public.br_state_name(new.city_state), new.city_state, 'BR')
      on conflict (city_key) do nothing;
  end if;
  if new.second_city_state is not null and public.br_state_name(new.second_city_state) is not null then
    insert into public.city_regions (city_key, city, state, state_code, country)
      values (public.city_key(new.second_city), btrim(new.second_city), public.br_state_name(new.second_city_state), new.second_city_state, 'BR')
      on conflict (city_key) do nothing;
  end if;
  return new;
end;
$$;

create trigger profiles_remember_cities
  after insert or update of city, city_state, second_city, second_city_state on public.profiles
  for each row execute function public.remember_profile_cities();

-- Cadastro novo: as cidades vêm junto com nome e telefone.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  name text := coalesce(new.raw_user_meta_data ->> 'full_name', '');
  phone text := left(btrim(coalesce(new.raw_user_meta_data ->> 'phone', '')), 20);
  v_city text := left(btrim(coalesce(new.raw_user_meta_data ->> 'city', '')), 60);
  v_uf text := upper(btrim(coalesce(new.raw_user_meta_data ->> 'city_state', '')));
  v_second text := nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'second_city', '')), 60), '');
  v_second_uf text := upper(btrim(coalesce(new.raw_user_meta_data ->> 'second_city_state', '')));
begin
  if public.br_state_name(v_uf) is null then v_uf := null; end if;
  if public.br_state_name(v_second_uf) is null then v_second_uf := null; end if;
  if v_second is null or v_second_uf is null then v_second := null; v_second_uf := null; end if;
  insert into public.profiles (id, display_name, city, city_state, second_city, second_city_state)
    values (new.id, public.short_name(name), case when v_uf is null then '' else v_city end, v_uf, v_second, v_second_uf);
  insert into public.profile_private (id, full_name, phone) values (new.id, name, phone);
  return new;
end;
$$;

-- A própria pessoa muda as suas cidades (as regras do perfil continuam valendo).
grant update (city_state, second_city, second_city_state) on public.profiles to authenticated;
revoke execute on function public.remember_profile_cities() from public, anon, authenticated;
