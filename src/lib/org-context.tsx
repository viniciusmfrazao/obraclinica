"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { supabase } from "./supabase";
import { useAuth } from "./auth-context";

export interface Organization {
  id: string;
  name: string;
  role: "owner" | "member";
}

interface OrgContextValue {
  organizations: Organization[];
  currentOrgId: string | null;
  currentOrg: Organization | null;
  loading: boolean;
  setCurrentOrgId: (id: string) => void;
  createOrganization: (name: string) => Promise<string | null>;
  refresh: () => Promise<void>;
}

const STORAGE_KEY = "obraclinica:current-org";

const OrgContext = createContext<OrgContextValue>({
  organizations: [],
  currentOrgId: null,
  currentOrg: null,
  loading: true,
  setCurrentOrgId: () => {},
  createOrganization: async () => null,
  refresh: async () => {},
});

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrgId, setCurrentOrgIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) {
      setOrganizations([]);
      setCurrentOrgIdState(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("organization_members")
      .select("role, organizations(id, name)")
      .eq("user_id", session.user.id);

    type Row = { role: "owner" | "member"; organizations: { id: string; name: string } | null };
    const orgs: Organization[] = ((data ?? []) as unknown as Row[])
      .filter((row) => row.organizations)
      .map((row) => ({
        id: row.organizations!.id,
        name: row.organizations!.name,
        role: row.role,
      }));
    setOrganizations(orgs);

    const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const valid = orgs.find((o) => o.id === saved);
    setCurrentOrgIdState(valid ? valid.id : orgs[0]?.id ?? null);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  function setCurrentOrgId(id: string) {
    setCurrentOrgIdState(id);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, id);
  }

  async function createOrganization(name: string): Promise<string | null> {
    if (!session) return null;
    const { data: org, error } = await supabase
      .from("organizations")
      .insert({ name, created_by: session.user.id })
      .select()
      .single();
    if (error || !org) return null;
    await supabase
      .from("organization_members")
      .insert({ organization_id: org.id, user_id: session.user.id, role: "owner" });
    await load();
    setCurrentOrgId(org.id);
    return org.id as string;
  }

  const currentOrg = organizations.find((o) => o.id === currentOrgId) ?? null;

  return (
    <OrgContext.Provider
      value={{
        organizations,
        currentOrgId,
        currentOrg,
        loading,
        setCurrentOrgId,
        createOrganization,
        refresh: load,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  return useContext(OrgContext);
}
