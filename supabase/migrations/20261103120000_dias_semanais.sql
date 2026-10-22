-- =============================================================================
-- Dias que se repetem toda semana (decisão de 22/10/2026)
-- -----------------------------------------------------------------------------
-- O Host marca os dias da semana em que sempre aluga (ex.: sábado e domingo).
-- O site libera esses dias pelos próximos 90 dias e, todo dia, libera o novo
-- dia que entra nessa janela. Fechar um dia avulso continua no calendário (ele
-- não volta sozinho, porque só o dia novo da janela é liberado).
-- Também guarda a procura por cidade para o simulador de ganhos do Host.
-- =============================================================================

create table public.equipment_weekly_days (
  equipment_id uuid not null references public.equipment (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = domingo
  primary key (equipment_id, weekday)
);
alter table public.equipment_weekly_days enable row level security;
create policy "Dias da semana: o dono e a equipe veem" on public.equipment_weekly_days
  for select to authenticated using (public.owns_equipment(equipment_id) or public.is_admin());
revoke insert, update, delete on public.equipment_weekly_days from anon, authenticated;

/** Janela de dias liberados automaticamente. */
create or replace function public.weekly_window_days()
returns integer language sql immutable set search_path = '' as $$ select 90 $$;

/**
 * Troca os dias da semana do equipamento (só o dono ou a equipe). Libera os
 * dias novos na janela de 90 dias e fecha, dentro da janela, os dias da semana
 * que saíram (menos os que já têm aluguel aceito).
 */
create or replace function public.set_weekly_days(p_equipment uuid, p_weekdays smallint[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  today date := public.today_sp();
  old_days smallint[];
  wanted smallint[] := coalesce((select array_agg(distinct d) from unnest(p_weekdays) d where d between 0 and 6), '{}');
begin
  if not (public.owns_equipment(p_equipment) or public.is_admin()) then raise exception 'not_allowed'; end if;
  select coalesce(array_agg(weekday), '{}') into old_days from public.equipment_weekly_days where equipment_id = p_equipment;

  delete from public.equipment_weekly_days where equipment_id = p_equipment;
  insert into public.equipment_weekly_days (equipment_id, weekday) select p_equipment, d from unnest(wanted) d;

  insert into public.equipment_available_days (equipment_id, day)
    select p_equipment, today + n from generate_series(0, public.weekly_window_days()) n
     where extract(dow from today + n)::smallint = any (wanted)
    on conflict do nothing;

  delete from public.equipment_available_days a
   where a.equipment_id = p_equipment and a.day >= today and a.day <= today + public.weekly_window_days()
     and extract(dow from a.day)::smallint = any (old_days)
     and not (extract(dow from a.day)::smallint = any (wanted))
     and not exists (select 1 from public.bookings x
                      where x.equipment_id = p_equipment and x.status in ('accepted', 'confirmed', 'active')
                        and a.day between x.start_date and x.end_date);
end;
$$;
revoke execute on function public.set_weekly_days(uuid, smallint[]) from public, anon;
grant execute on function public.set_weekly_days(uuid, smallint[]) to authenticated;

/** Todo dia: libera o dia que acabou de entrar na janela de 90 dias. */
create or replace function public.extend_weekly_days()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  target date := public.today_sp() + public.weekly_window_days();
  n integer;
begin
  insert into public.equipment_available_days (equipment_id, day)
    select w.equipment_id, target from public.equipment_weekly_days w
     where w.weekday = extract(dow from target)::smallint
    on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.extend_weekly_days() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      perform cron.schedule('dias-semanais', '5 3 * * *', 'select public.extend_weekly_days()');
    exception when others then
      raise notice 'Dias semanais não agendados: %', sqlerrm;
    end;
  end if;
end;
$$;

/**
 * Simulador de ganhos do Host: procura numa cidade (viagens marcadas nos
 * próximos 90 dias e equipamentos publicados lá) e diária média dos anúncios.
 * Só números agregados, sem nada das pessoas.
 */
create or replace function public.city_demand_summary(p_city text)
returns table (trips_90 bigint, equipment bigint, avg_daily numeric)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*) from public.rider_trips t
      where public.city_key(t.city) = public.city_key(p_city)
        and t.until_day >= public.today_sp() and t.from_day <= public.today_sp() + 90),
    (select count(*) from public.equipment e
      where e.review_status = 'approved' and e.is_available and public.city_key(e.city) = public.city_key(p_city)),
    (select round(avg(e.daily_price), 2) from public.equipment e
      where e.review_status = 'approved' and public.city_key(e.city) = public.city_key(p_city))
$$;
revoke execute on function public.city_demand_summary(text) from public, anon;
grant execute on function public.city_demand_summary(text) to authenticated;
