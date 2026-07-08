-- ObraClínica — schema inicial
create extension if not exists pgcrypto;

-- ACTIVITIES ----------------------------------------------------------
create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'planejado'
    check (status in ('planejado', 'em_andamento', 'concluido')),
  date date not null default current_date,
  created_at timestamptz not null default now()
);

-- PAYMENTS -------------------------------------------------------------
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  amount numeric(12,2) not null,
  category text not null default 'outros'
    check (category in ('material', 'mao_de_obra', 'projeto', 'equipamento', 'outros')),
  supplier text,
  date date not null default current_date,
  receipt_path text,
  activity_id uuid references activities(id) on delete set null,
  created_at timestamptz not null default now()
);

-- DOCUMENTS --------------------------------------------------------------
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'outros'
    check (category in ('contrato', 'nota_fiscal', 'projeto', 'alvara', 'outros')),
  file_path text not null,
  activity_id uuid references activities(id) on delete set null,
  date date not null default current_date,
  created_at timestamptz not null default now()
);

-- PHOTOS -------------------------------------------------------------------
create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  description text,
  photo_path text not null,
  activity_id uuid references activities(id) on delete set null,
  date date not null default current_date,
  created_at timestamptz not null default now()
);

-- INDEXES --------------------------------------------------------------
create index if not exists idx_payments_activity on payments(activity_id);
create index if not exists idx_documents_activity on documents(activity_id);
create index if not exists idx_photos_activity on photos(activity_id);

-- ROW LEVEL SECURITY -----------------------------------------------------
-- Uso pessoal: qualquer usuário autenticado (você) tem acesso total.
alter table activities enable row level security;
alter table payments enable row level security;
alter table documents enable row level security;
alter table photos enable row level security;

create policy "authenticated full access" on activities
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on payments
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on documents
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on photos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- STORAGE BUCKETS --------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "authenticated read photos" on storage.objects
  for select using (bucket_id = 'photos' and auth.role() = 'authenticated');
create policy "authenticated write photos" on storage.objects
  for insert with check (bucket_id = 'photos' and auth.role() = 'authenticated');
create policy "authenticated delete photos" on storage.objects
  for delete using (bucket_id = 'photos' and auth.role() = 'authenticated');

create policy "authenticated read documents" on storage.objects
  for select using (bucket_id = 'documents' and auth.role() = 'authenticated');
create policy "authenticated write documents" on storage.objects
  for insert with check (bucket_id = 'documents' and auth.role() = 'authenticated');
create policy "authenticated delete documents" on storage.objects
  for delete using (bucket_id = 'documents' and auth.role() = 'authenticated');
