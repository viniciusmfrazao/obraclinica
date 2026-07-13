-- ObraClínica — Multi-tenant (organizações / obras)

-- ORGANIZATIONS ----------------------------------------------------------
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

alter table organizations enable row level security;
alter table organization_members enable row level security;

create policy "members can view their organizations" on organizations
  for select to authenticated
  using (id in (select organization_id from organization_members where user_id = auth.uid()));

create policy "authenticated can create organizations" on organizations
  for insert to authenticated
  with check (created_by = auth.uid());

create policy "owners can update their organizations" on organizations
  for update to authenticated
  using (id in (select organization_id from organization_members where user_id = auth.uid() and role = 'owner'));

create policy "members can view membership rows in their orgs" on organization_members
  for select to authenticated
  using (organization_id in (select organization_id from organization_members where user_id = auth.uid()));

create policy "users can insert their own membership" on organization_members
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "owners can manage members" on organization_members
  for all to authenticated
  using (organization_id in (select organization_id from organization_members where user_id = auth.uid() and role = 'owner'))
  with check (organization_id in (select organization_id from organization_members where user_id = auth.uid() and role = 'owner'));

-- BACKFILL: cria a obra atual e migra todos os dados existentes ------------
do $$
declare
  v_org_id uuid;
  v_user_id uuid := 'b48e7b53-d521-4e1a-915e-e73fe5111a33';
begin
  insert into organizations (name, created_by)
  values ('Construção da Clínica', v_user_id)
  returning id into v_org_id;

  insert into organization_members (organization_id, user_id, role)
  values (v_org_id, v_user_id, 'owner');

  -- adiciona a coluna organization_id em todas as tabelas de dados
  alter table activities add column if not exists organization_id uuid references organizations(id) on delete cascade;
  alter table payments add column if not exists organization_id uuid references organizations(id) on delete cascade;
  alter table documents add column if not exists organization_id uuid references organizations(id) on delete cascade;
  alter table folders add column if not exists organization_id uuid references organizations(id) on delete cascade;
  alter table photos add column if not exists organization_id uuid references organizations(id) on delete cascade;
  alter table budgets add column if not exists organization_id uuid references organizations(id) on delete cascade;
  alter table installments add column if not exists organization_id uuid references organizations(id) on delete cascade;
  alter table shopping_list_items add column if not exists organization_id uuid references organizations(id) on delete cascade;
  alter table daily_reports add column if not exists organization_id uuid references organizations(id) on delete cascade;
  alter table report_labor add column if not exists organization_id uuid references organizations(id) on delete cascade;
  alter table report_equipment add column if not exists organization_id uuid references organizations(id) on delete cascade;
  alter table report_activities add column if not exists organization_id uuid references organizations(id) on delete cascade;
  alter table report_occurrences add column if not exists organization_id uuid references organizations(id) on delete cascade;
  alter table report_materials add column if not exists organization_id uuid references organizations(id) on delete cascade;

  update activities set organization_id = v_org_id where organization_id is null;
  update payments set organization_id = v_org_id where organization_id is null;
  update documents set organization_id = v_org_id where organization_id is null;
  update folders set organization_id = v_org_id where organization_id is null;
  update photos set organization_id = v_org_id where organization_id is null;
  update budgets set organization_id = v_org_id where organization_id is null;
  update installments set organization_id = v_org_id where organization_id is null;
  update shopping_list_items set organization_id = v_org_id where organization_id is null;
  update daily_reports set organization_id = v_org_id where organization_id is null;
  update report_labor set organization_id = v_org_id where organization_id is null;
  update report_equipment set organization_id = v_org_id where organization_id is null;
  update report_activities set organization_id = v_org_id where organization_id is null;
  update report_occurrences set organization_id = v_org_id where organization_id is null;
  update report_materials set organization_id = v_org_id where organization_id is null;
end $$;

-- torna organization_id obrigatório a partir de agora -----------------------
alter table activities alter column organization_id set not null;
alter table payments alter column organization_id set not null;
alter table documents alter column organization_id set not null;
alter table folders alter column organization_id set not null;
alter table photos alter column organization_id set not null;
alter table budgets alter column organization_id set not null;
alter table installments alter column organization_id set not null;
alter table shopping_list_items alter column organization_id set not null;
alter table daily_reports alter column organization_id set not null;
alter table report_labor alter column organization_id set not null;
alter table report_equipment alter column organization_id set not null;
alter table report_activities alter column organization_id set not null;
alter table report_occurrences alter column organization_id set not null;
alter table report_materials alter column organization_id set not null;

-- RDO: número do relatório passa a ser único por obra, não globalmente -------
alter table daily_reports drop constraint if exists daily_reports_report_date_key;
create unique index if not exists idx_daily_reports_org_date on daily_reports(organization_id, report_date);

-- índices por organização ----------------------------------------------------
create index if not exists idx_activities_org on activities(organization_id);
create index if not exists idx_payments_org on payments(organization_id);
create index if not exists idx_documents_org on documents(organization_id);
create index if not exists idx_folders_org on folders(organization_id);
create index if not exists idx_photos_org on photos(organization_id);
create index if not exists idx_budgets_org on budgets(organization_id);
create index if not exists idx_installments_org on installments(organization_id);
create index if not exists idx_shopping_list_items_org on shopping_list_items(organization_id);
create index if not exists idx_daily_reports_org on daily_reports(organization_id);
create index if not exists idx_report_labor_org on report_labor(organization_id);
create index if not exists idx_report_equipment_org on report_equipment(organization_id);
create index if not exists idx_report_activities_org on report_activities(organization_id);
create index if not exists idx_report_occurrences_org on report_occurrences(organization_id);
create index if not exists idx_report_materials_org on report_materials(organization_id);

-- RLS: remove policies antigas (acesso total a qualquer autenticado) --------
drop policy if exists "auth all daily_reports" on daily_reports;
drop policy if exists "auth all report_labor" on report_labor;
drop policy if exists "auth all report_equipment" on report_equipment;
drop policy if exists "auth all report_activities" on report_activities;
drop policy if exists "auth all report_occurrences" on report_occurrences;
drop policy if exists "auth all report_materials" on report_materials;

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'activities','payments','documents','folders','photos','budgets','installments','shopping_list_items'
  ]) loop
    execute format('drop policy if exists "authenticated full access" on %I', t);
  end loop;
end $$;

-- RLS: novas policies restritas por organização ------------------------------
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'activities','payments','documents','folders','photos','budgets','installments','shopping_list_items',
    'daily_reports','report_labor','report_equipment','report_activities','report_occurrences','report_materials'
  ]) loop
    execute format(
      'create policy "org members access %s" on %I for all to authenticated ' ||
      'using (organization_id in (select organization_id from organization_members where user_id = auth.uid())) ' ||
      'with check (organization_id in (select organization_id from organization_members where user_id = auth.uid()))',
      t, t
    );
  end loop;
end $$;

-- STORAGE: fotos e documentos ficam em pastas por obra ({organization_id}/arquivo)
drop policy if exists "authenticated read photos" on storage.objects;
drop policy if exists "authenticated write photos" on storage.objects;
drop policy if exists "authenticated delete photos" on storage.objects;
drop policy if exists "authenticated read documents" on storage.objects;
drop policy if exists "authenticated write documents" on storage.objects;
drop policy if exists "authenticated delete documents" on storage.objects;

create policy "org members read photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1]::uuid in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "org members write photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1]::uuid in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "org members delete photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1]::uuid in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "org members read documents" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "org members write documents" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "org members delete documents" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );
