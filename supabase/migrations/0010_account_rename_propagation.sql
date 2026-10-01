-- Ao renomear uma conta, atualiza o texto copiado em pagamentos e contas a pagar.
-- AFTER UPDATE: o gatilho de sincronização dos lançamentos precisa enxergar o nome novo.
drop trigger if exists accounts_propagate_rename on public.accounts;

create or replace function public.propagate_account_rename()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.name is distinct from old.name then
    update public.payments set account = new.name where account_id = new.id;
    update public.installments set account = new.name where account_id = new.id;
  end if;
  return null;
end;
$$;

create trigger accounts_propagate_rename after update of name on public.accounts
  for each row execute function public.propagate_account_rename();
