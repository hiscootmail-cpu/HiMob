-- =============================================================================
-- Rider em viagem: data de ida (decisão de 22/10/2026)
-- -----------------------------------------------------------------------------
-- A pessoa pode avisar antes: "de 10 de outubro a 15 de novembro". A viagem só
-- passa a valer (Explorar abre na cidade) a partir da data de ida.
-- =============================================================================

alter table public.profiles add column travel_from date;

-- Viagens já marcadas valem desde hoje (ou desde a volta, se já passou).
update public.profiles set travel_from = least(public.today_sp(), travel_until) where travel_city is not null;

alter table public.profiles
  add check ((travel_city is null) = (travel_from is null)),
  add check (travel_from is null or travel_until is null or travel_from <= travel_until);

grant update (travel_from) on public.profiles to authenticated;
