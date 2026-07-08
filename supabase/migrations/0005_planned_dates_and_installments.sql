-- Datas previstas por atividade
alter table activities
  add column if not exists planned_start date,
  add column if not exists planned_end date;

-- Contas a pagar (parcelas/pagamentos futuros)
create table if not exists installments (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  amount numeric(12,2) not null,
  category text not null default 'outros'
    check (category in ('material', 'mao_de_obra', 'projeto', 'equipamento', 'outros')),
  supplier text,
  account text,
  due_date date not null,
  activity_id uuid references activities(id) on delete set null,
  status text not null default 'pendente' check (status in ('pendente', 'pago')),
  paid_payment_id uuid references payments(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_installments_due on installments(due_date);
create index if not exists idx_installments_activity on installments(activity_id);

alter table installments enable row level security;
create policy "authenticated full access" on installments
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
