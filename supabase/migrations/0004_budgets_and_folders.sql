-- Orçamento por categoria ou por atividade
create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  category text,
  activity_id uuid references activities(id) on delete cascade,
  amount numeric(12,2) not null,
  created_at timestamptz not null default now(),
  constraint budgets_target_check check (
    (category is not null and activity_id is null) or
    (category is null and activity_id is not null)
  )
);

create unique index if not exists uniq_budget_category on budgets(category) where category is not null;
create unique index if not exists uniq_budget_activity on budgets(activity_id) where activity_id is not null;

alter table budgets enable row level security;
create policy "authenticated full access" on budgets
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Pastas de documentos
create table if not exists folders (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table folders enable row level security;
create policy "authenticated full access" on folders
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table documents add column if not exists folder_id uuid references folders(id) on delete set null;
create index if not exists idx_documents_folder on documents(folder_id);
