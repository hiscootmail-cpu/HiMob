-- =============================================================================
-- Rider em viagem (decisão de 21/10/2026)
-- -----------------------------------------------------------------------------
-- Na aba Rider a pessoa marca "Estou em viagem", escolhe a cidade (lista oficial)
-- e até quando fica. Enquanto a viagem vale, o Explorar abre nessa cidade. No
-- dia seguinte à data de volta, deixa de valer sozinho (o site compara a data).
-- =============================================================================

alter table public.profiles
  add column travel_city text check (travel_city is null or char_length(btrim(travel_city)) between 1 and 60),
  add column travel_city_state text check (travel_city_state is null or travel_city_state ~ '^[A-Z]{2}$'),
  add column travel_until date,
  add check ((travel_city is null) = (travel_city_state is null) and (travel_city is null) = (travel_until is null));

grant update (travel_city, travel_city_state, travel_until) on public.profiles to authenticated;

-- A cidade da viagem também entra nas regiões (estado e país) do Painel → Operação.
create or replace function public.remember_profile_cities()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  pair record;
begin
  for pair in select * from (values (new.city, new.city_state), (new.second_city, new.second_city_state), (new.travel_city, new.travel_city_state)) as p(city, uf)
  loop
    if pair.uf is not null and public.br_state_name(pair.uf) is not null and btrim(coalesce(pair.city, '')) <> '' then
      insert into public.city_regions (city_key, city, state, state_code, country)
        values (public.city_key(pair.city), btrim(pair.city), public.br_state_name(pair.uf), pair.uf, 'BR')
        on conflict (city_key) do nothing;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger profiles_remember_cities on public.profiles;
create trigger profiles_remember_cities
  after insert or update of city, city_state, second_city, second_city_state, travel_city, travel_city_state on public.profiles
  for each row execute function public.remember_profile_cities();
