-- =============================================================================
-- Hi Scoot · Telefone obrigatório no cadastro (decisão de 19/10/2026)
-- =============================================================================
-- O telefone informado no cadastro vai direto para a parte privada do perfil.
-- Ele só aparece para a outra pessoa depois de uma reserva aceita.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  name text := coalesce(new.raw_user_meta_data ->> 'full_name', '');
  phone text := left(btrim(coalesce(new.raw_user_meta_data ->> 'phone', '')), 20);
begin
  insert into public.profiles (id, display_name) values (new.id, public.short_name(name));
  insert into public.profile_private (id, full_name, phone) values (new.id, name, phone);
  return new;
end;
$$;
