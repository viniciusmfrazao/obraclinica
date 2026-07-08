create table if not exists shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  quantity numeric(10,2) not null default 1,
  unit text not null default 'un',
  estimated_price numeric(12,2),
  done boolean not null default false,
  activity_id uuid references activities(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_shopping_activity on shopping_list_items(activity_id);

alter table shopping_list_items enable row level security;

create policy "authenticated full access" on shopping_list_items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
