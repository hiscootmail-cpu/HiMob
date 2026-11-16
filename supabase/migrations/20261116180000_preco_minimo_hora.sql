-- Preço por hora mínimo de R$ 30 para o Host (decisão de 16/11/2026).
-- Anúncios antigos (preço por hora calculado pela diária) sobem para R$ 30/h,
-- e a diária (teto) passa a valer pelo menos 6 horas (R$ 180).
-- Reservas já feitas não mudam (guardam o preço do dia da reserva).

update public.equipment
  set daily_price = greatest(daily_price, 180), hourly_price = 30
  where hourly_price is null or hourly_price < 30;

-- Edições em análise com preço abaixo do mínimo sobem para o mínimo.
update public.equipment_edits
  set changes = jsonb_set(changes, '{hourly_price}', '30')
  where status = 'pending' and changes ? 'hourly_price' and (changes ->> 'hourly_price')::numeric < 30;
update public.equipment_edits
  set changes = jsonb_set(changes, '{daily_price}', '180')
  where status = 'pending' and changes ? 'daily_price' and (changes ->> 'daily_price')::numeric < 180
    and (changes ? 'hourly_price');

alter table public.equipment
  add constraint equipment_hourly_min check (hourly_price is null or hourly_price >= 30);
