-- ObraClínica — Diário de Obra (RDO)

-- RELATÓRIO DIÁRIO -----------------------------------------------------
create table if not exists daily_reports (
  id uuid primary key default gen_random_uuid(),
  report_number int not null,
  report_date date not null unique,
  weather_morning text
    check (weather_morning in ('sol', 'parcial', 'nublado', 'chuva', 'chuva_forte')),
  weather_afternoon text
    check (weather_afternoon in ('sol', 'parcial', 'nublado', 'chuva', 'chuva_forte')),
  workable_morning boolean not null default true,
  workable_afternoon boolean not null default true,
  temp_min numeric(5,1),
  temp_max numeric(5,1),
  rain_mm numeric(6,1),
  work_start time,
  work_end time,
  summary text,
  notes text,
  status text not null default 'rascunho'
    check (status in ('rascunho', 'finalizado')),
  signed_by text,
  finalized_at timestamptz,
  created_at timestamptz not null default now()
);

-- MÃO DE OBRA -----------------------------------------------------------
create table if not exists report_labor (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references daily_reports(id) on delete cascade,
  role text not null,
  quantity int not null default 1,
  note text,
  created_at timestamptz not null default now()
);

-- EQUIPAMENTOS ----------------------------------------------------------
create table if not exists report_equipment (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references daily_reports(id) on delete cascade,
  name text not null,
  quantity int not null default 1,
  note text,
  created_at timestamptz not null default now()
);

-- ATIVIDADES EXECUTADAS NO DIA -------------------------------------------
create table if not exists report_activities (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references daily_reports(id) on delete cascade,
  activity_id uuid references activities(id) on delete set null,
  description text not null,
  status text not null default 'em_andamento'
    check (status in ('iniciada', 'em_andamento', 'concluida', 'paralisada')),
  progress int not null default 0 check (progress between 0 and 100),
  created_at timestamptz not null default now()
);

-- OCORRÊNCIAS ------------------------------------------------------------
create table if not exists report_occurrences (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references daily_reports(id) on delete cascade,
  type text not null default 'outros'
    check (type in ('clima', 'atraso', 'acidente', 'visita', 'entrega', 'nao_conformidade', 'paralisacao', 'outros')),
  description text not null,
  is_pending boolean not null default false,
  resolved boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- MATERIAIS RECEBIDOS ------------------------------------------------------
create table if not exists report_materials (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references daily_reports(id) on delete cascade,
  name text not null,
  quantity text,
  supplier text,
  created_at timestamptz not null default now()
);

-- INDEXES ------------------------------------------------------------------
create index if not exists idx_daily_reports_date on daily_reports(report_date desc);
create index if not exists idx_report_labor_report on report_labor(report_id);
create index if not exists idx_report_equipment_report on report_equipment(report_id);
create index if not exists idx_report_activities_report on report_activities(report_id);
create index if not exists idx_report_occurrences_report on report_occurrences(report_id);
create index if not exists idx_report_occurrences_pending on report_occurrences(is_pending) where is_pending = true;
create index if not exists idx_report_materials_report on report_materials(report_id);

-- ROW LEVEL SECURITY ---------------------------------------------------------
alter table daily_reports enable row level security;
alter table report_labor enable row level security;
alter table report_equipment enable row level security;
alter table report_activities enable row level security;
alter table report_occurrences enable row level security;
alter table report_materials enable row level security;

create policy "auth all daily_reports" on daily_reports
  for all to authenticated using (true) with check (true);
create policy "auth all report_labor" on report_labor
  for all to authenticated using (true) with check (true);
create policy "auth all report_equipment" on report_equipment
  for all to authenticated using (true) with check (true);
create policy "auth all report_activities" on report_activities
  for all to authenticated using (true) with check (true);
create policy "auth all report_occurrences" on report_occurrences
  for all to authenticated using (true) with check (true);
create policy "auth all report_materials" on report_materials
  for all to authenticated using (true) with check (true);
