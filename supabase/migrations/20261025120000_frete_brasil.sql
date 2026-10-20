-- =============================================================================
-- Mundo Scoot · Frete para todo o Brasil (decisão de 20/10/2026)
-- -----------------------------------------------------------------------------
-- Envio por PAC saindo de Mogi Mirim (450 g, envelope), pelas simulações:
-- - Sudeste (SP, RJ, MG, ES): R$ 35,00 (Mogi Mirim → Rio de Janeiro).
-- - Demais estados: R$ 65,00 (a mais cara, Mogi Mirim → Manaus).
-- A equipe ajusta cada estado no painel (Mundo Scoot → Frete).
-- Estado que já tem valor cadastrado continua como está.
-- =============================================================================

insert into public.world_shipping_rates (state, city, price)
select uf, null, case when uf in ('SP', 'RJ', 'MG', 'ES') then 35.00 else 65.00 end
from unnest(array['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
                  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']) as uf
where not exists (select 1 from public.world_shipping_rates r where r.state = uf and r.city is null);
