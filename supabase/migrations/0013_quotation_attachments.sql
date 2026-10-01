-- Anexos (PDF, imagens, planilhas…) nos orçamentos: gerais ou de um fornecedor.
-- Os arquivos ficam no bucket "documents", em {organization_id}/orcamentos/…
create table public.quotation_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  supplier_id uuid references public.quotation_suppliers(id) on delete set null,
  name text not null check (length(btrim(name)) > 0),
  file_path text not null,
  created_at timestamptz not null default now()
);

create index quotation_attachments_q_idx on public.quotation_attachments (quotation_id);

alter table public.quotation_attachments enable row level security;
create policy "members can view" on public.quotation_attachments for select using (public.is_org_member(organization_id));
create policy "members can insert" on public.quotation_attachments for insert with check (public.is_org_member(organization_id));
create policy "members can update" on public.quotation_attachments for update
  using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members can delete" on public.quotation_attachments for delete using (public.is_org_member(organization_id));
