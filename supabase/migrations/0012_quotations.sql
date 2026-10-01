-- Orçamentos de compra: itens, fornecedores e preços lado a lado.
create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  category text not null default 'material'
    check (category in ('material', 'mao_de_obra', 'projeto', 'equipamento', 'documentacao', 'outros')),
  activity_id uuid references public.activities(id) on delete set null,
  notes text,
  status text not null default 'aberto' check (status in ('aberto', 'fechado', 'cancelado')),
  chosen_supplier_id uuid,
  installment_id uuid references public.installments(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  description text not null check (length(btrim(description)) > 0),
  quantity numeric not null default 1 check (quantity > 0),
  unit text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.quotation_suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  freight numeric not null default 0 check (freight >= 0),
  payment_terms text,
  delivery_time text,
  notes text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.quotations
  add constraint quotations_chosen_supplier_fk
  foreign key (chosen_supplier_id) references public.quotation_suppliers(id) on delete set null;

create table public.quotation_prices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  supplier_id uuid not null references public.quotation_suppliers(id) on delete cascade,
  item_id uuid not null references public.quotation_items(id) on delete cascade,
  unit_price numeric not null check (unit_price >= 0),
  unique (supplier_id, item_id)
);

create index quotations_org_idx on public.quotations (organization_id, created_at desc);
create index quotation_items_q_idx on public.quotation_items (quotation_id);
create index quotation_suppliers_q_idx on public.quotation_suppliers (quotation_id);
create index quotation_prices_q_idx on public.quotation_prices (quotation_id);

do $$
declare t text;
begin
  foreach t in array array['quotations','quotation_items','quotation_suppliers','quotation_prices'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "members can view" on public.%I for select using (public.is_org_member(organization_id))', t);
    execute format('create policy "members can insert" on public.%I for insert with check (public.is_org_member(organization_id))', t);
    execute format('create policy "members can update" on public.%I for update using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id))', t);
    execute format('create policy "members can delete" on public.%I for delete using (public.is_org_member(organization_id))', t);
  end loop;
end $$;
