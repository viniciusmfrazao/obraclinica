-- Cadastro de contas/bancos de origem do dinheiro, ligado a pagamentos e contas a pagar.
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index accounts_org_name_uidx on public.accounts (organization_id, lower(btrim(name)));
alter table public.accounts enable row level security;

create policy "members can view accounts" on public.accounts for select using (public.is_org_member(organization_id));
create policy "members can insert accounts" on public.accounts for insert with check (public.is_org_member(organization_id));
create policy "members can update accounts" on public.accounts for update
  using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "owners can delete accounts" on public.accounts for delete using (public.is_org_owner(organization_id));

alter table public.payments add column account_id uuid references public.accounts(id) on delete restrict;
alter table public.installments add column account_id uuid references public.accounts(id) on delete restrict;
create index payments_account_id_idx on public.payments (account_id);
create index installments_account_id_idx on public.installments (account_id);

insert into public.accounts (organization_id, name)
select distinct on (organization_id, lower(btrim(account))) organization_id, btrim(account)
from (
  select organization_id, account from public.payments where account is not null and btrim(account) <> ''
  union all
  select organization_id, account from public.installments where account is not null and btrim(account) <> ''
) s
order by organization_id, lower(btrim(account)), btrim(account);

update public.payments p set account_id = a.id, account = a.name from public.accounts a
  where a.organization_id = p.organization_id and lower(btrim(p.account)) = lower(btrim(a.name));
update public.installments i set account_id = a.id, account = a.name from public.accounts a
  where a.organization_id = i.organization_id and lower(btrim(i.account)) = lower(btrim(a.name));

create or replace function public.sync_account_ref()
returns trigger language plpgsql security definer set search_path = public as $$
declare acc public.accounts;
begin
  if new.account_id is not null then
    select * into acc from public.accounts where id = new.account_id;
    if acc.id is null or acc.organization_id <> new.organization_id then
      raise exception 'Conta inválida para esta obra';
    end if;
    new.account := acc.name;
  elsif new.account is not null and btrim(new.account) <> '' then
    select * into acc from public.accounts
      where organization_id = new.organization_id and lower(btrim(name)) = lower(btrim(new.account));
    if acc.id is null then
      insert into public.accounts (organization_id, name) values (new.organization_id, btrim(new.account)) returning * into acc;
    end if;
    new.account_id := acc.id;
    new.account := acc.name;
  end if;
  return new;
end;
$$;

create trigger payments_sync_account before insert or update of account, account_id on public.payments
  for each row execute function public.sync_account_ref();
create trigger installments_sync_account before insert or update of account, account_id on public.installments
  for each row execute function public.sync_account_ref();
