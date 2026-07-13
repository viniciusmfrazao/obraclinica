"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useOrg } from "@/lib/org-context";
import Sidebar, { OrgSwitcher } from "./Sidebar";

function OnboardingOrg() {
  const { createOrganization } = useOrg();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const id = await createOrganization(name.trim());
    setSaving(false);
    if (!id) alert("Não foi possível criar a obra. Tente novamente.");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper bg-blueprint-grid px-4">
      <form
        onSubmit={handleCreate}
        className="w-full max-w-sm bg-card border border-line rounded-lg shadow-sm p-8"
      >
        <p className="text-xs tracking-[0.2em] text-blueprint font-mono uppercase mb-1">
          Bem-vindo ao ObraClínica
        </p>
        <h1 className="text-xl font-display font-semibold text-ink mb-2">
          Vamos criar sua primeira obra
        </h1>
        <p className="text-sm text-ink-soft mb-6">
          Cada obra tem seu próprio diário, atividades, pagamentos e documentos,
          totalmente separados das demais.
        </p>
        <label className="block text-sm text-ink-soft mb-1" htmlFor="org-name">
          Nome da obra
        </label>
        <input
          id="org-name"
          autoFocus
          required
          placeholder="Ex.: Construção da Clínica"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-line bg-white px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-blueprint mb-4"
        />
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="w-full rounded-md bg-blueprint hover:bg-blueprint-dark transition-colors text-white font-medium py-2.5 disabled:opacity-60"
        >
          {saving ? "Criando..." : "Criar obra"}
        </button>
      </form>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session, loading: authLoading } = useAuth();
  const { organizations, loading: orgLoading } = useOrg();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (authLoading || !session || orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper bg-blueprint-grid">
        <p className="font-mono text-sm text-ink-soft">Carregando…</p>
      </div>
    );
  }

  if (organizations.length === 0) {
    return <OnboardingOrg />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="md:hidden border-b border-line bg-card">
          <OrgSwitcher mobile />
        </div>
        <main className="flex-1 min-w-0 pb-16 md:pb-0 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
