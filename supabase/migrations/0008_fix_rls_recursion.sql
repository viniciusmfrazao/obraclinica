-- Corrige "infinite recursion detected in policy for relation organization_members".
-- As políticas consultavam a própria tabela; agora usam funções security definer.
create or replace function public.is_org_member(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members where organization_id = org and user_id = auth.uid());
$$;

create or replace function public.is_org_owner(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members where organization_id = org and user_id = auth.uid() and role = 'owner');
$$;

revoke all on function public.is_org_member(uuid) from public, anon;
revoke all on function public.is_org_owner(uuid) from public, anon;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_owner(uuid) to authenticated;

drop policy if exists "members can view membership rows in their orgs" on public.organization_members;
drop policy if exists "owners can manage members" on public.organization_members;
drop policy if exists "members can view their organizations" on public.organizations;
drop policy if exists "owners can update their organizations" on public.organizations;

create policy "members can view membership rows in their orgs" on public.organization_members for select
  using (user_id = auth.uid() or public.is_org_member(organization_id));
create policy "owners can manage members" on public.organization_members for all
  using (public.is_org_owner(organization_id)) with check (public.is_org_owner(organization_id));
create policy "members can view their organizations" on public.organizations for select
  using (public.is_org_member(id) or created_by = auth.uid());
create policy "owners can update their organizations" on public.organizations for update
  using (public.is_org_owner(id));
