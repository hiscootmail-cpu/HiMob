-- =============================================================================
-- Hi Scoot · "Avisar quando disponível" (decisão de 10/10/2026)
-- =============================================================================
-- Quando o Host marca o equipamento como disponível de novo, cada pessoa da
-- lista de espera recebe um aviso e sai da lista (o aviso vale uma vez).
-- =============================================================================

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'bookingRequest', 'bookingAccepted', 'bookingRejected', 'paymentConfirmed', 'pickupReminder',
  'returnConfirmed', 'reviewReceived', 'listingApproved', 'listingRejected',
  'documentApproved', 'documentRejected', 'newMessage', 'equipmentAvailable'));

create or replace function public.notify_waitlist()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.is_available and not old.is_available and new.review_status = 'approved' then
    insert into public.notifications (user_id, kind, href, title)
      select w.user_id, 'equipmentAvailable', '/equipment/' || new.id, new.title
        from public.waitlist w where w.equipment_id = new.id;
    delete from public.waitlist where equipment_id = new.id;
  end if;
  return new;
end;
$$;
revoke execute on function public.notify_waitlist() from public, anon, authenticated;

create trigger equipment_notify_waitlist
  after update of is_available on public.equipment
  for each row execute function public.notify_waitlist();

-- Só entra na lista de espera de anúncio publicado e de outra pessoa.
drop policy "Lista de espera: só a própria pessoa" on public.waitlist;
create policy "Lista de espera: a pessoa vê e sai da própria"
  on public.waitlist for select to authenticated using (user_id = auth.uid());
create policy "Lista de espera: a pessoa sai"
  on public.waitlist for delete to authenticated using (user_id = auth.uid());
create policy "Lista de espera: a pessoa entra em anúncio publicado de outra pessoa"
  on public.waitlist for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.equipment e where e.id = equipment_id and e.review_status = 'approved' and e.host_id <> auth.uid())
  );
revoke update on public.waitlist from authenticated;
