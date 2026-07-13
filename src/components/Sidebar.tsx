"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  ListChecks,
  Wallet,
  FileText,
  Images,
  ShoppingCart,
  LogOut,
  ChevronsUpDown,
  Check,
  Plus,
  Building2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useOrg } from "@/lib/org-context";
import Modal from "./Modal";

const NAV = [
  { href: "/", label: "Painel", icon: LayoutDashboard },
  { href: "/diario", label: "Diário", icon: BookOpen },
  { href: "/atividades", label: "Atividades", icon: ListChecks },
  { href: "/pagamentos", label: "Pagamentos", icon: Wallet },
  { href: "/lista-compras", label: "Compras", icon: ShoppingCart },
  { href: "/documentos", label: "Documentos", icon: FileText },
  { href: "/fotos", label: "Fotos", icon: Images },
];

export function OrgSwitcher({ mobile = false }: { mobile?: boolean }) {
  const { organizations, currentOrg, setCurrentOrgId, createOrganization } = useOrg();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    await createOrganization(newName.trim());
    setSaving(false);
    setNewName("");
    setCreating(false);
    setOpen(false);
  }

  if (organizations.length <= 1 && !mobile) {
    return (
      <div className="px-6 py-6 border-b border-line">
        <p className="text-[10px] tracking-[0.2em] text-blueprint font-mono uppercase mb-1">
          Diário de obra
        </p>
        <h1 className="text-lg font-display font-semibold text-ink truncate">
          {currentOrg?.name ?? "ObraClínica"}
        </h1>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 text-xs text-ink-soft hover:text-blueprint mt-2"
        >
          <Plus size={12} />
          Nova obra
        </button>
        <Modal open={creating} onClose={() => setCreating(false)} title="Nova obra">
          <form onSubmit={handleCreate} className="space-y-3">
            <input
              autoFocus
              placeholder="Nome da obra"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-paper border border-line rounded-md px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={saving || !newName.trim()}
              className="w-full bg-blueprint hover:bg-blueprint-dark text-white text-sm font-medium px-4 py-2 rounded-md transition-colors disabled:opacity-60"
            >
              {saving ? "Criando..." : "Criar e mudar para esta obra"}
            </button>
          </form>
        </Modal>
      </div>
    );
  }

  return (
    <div className="relative px-3 py-4 border-b border-line">
      <p className="text-[10px] tracking-[0.2em] text-blueprint font-mono uppercase mb-2 px-3">
        Obra atual
      </p>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 rounded-md px-3 py-2 hover:bg-paper transition-colors text-left min-w-0"
      >
        <Building2 size={16} className="text-blueprint shrink-0" />
        <span className="flex-1 min-w-0 truncate font-display font-semibold text-sm text-ink">
          {currentOrg?.name ?? "Selecionar obra"}
        </span>
        <ChevronsUpDown size={14} className="text-ink-soft shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-3 right-3 top-full mt-1 z-40 bg-card border border-line rounded-md shadow-lg overflow-hidden">
            <ul className="max-h-64 overflow-y-auto py-1">
              {organizations.map((o) => (
                <li key={o.id}>
                  <button
                    onClick={() => {
                      setCurrentOrgId(o.id);
                      setOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-paper text-left min-w-0"
                  >
                    <span className="flex-1 min-w-0 truncate text-ink">{o.name}</span>
                    {o.id === currentOrg?.id && (
                      <Check size={14} className="text-blueprint shrink-0" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
            <button
              onClick={() => {
                setOpen(false);
                setCreating(true);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blueprint border-t border-line hover:bg-paper"
            >
              <Plus size={14} />
              Nova obra
            </button>
          </div>
        </>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Nova obra">
        <form onSubmit={handleCreate} className="space-y-3">
          <input
            autoFocus
            placeholder="Nome da obra"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full bg-paper border border-line rounded-md px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={saving || !newName.trim()}
            className="w-full bg-blueprint hover:bg-blueprint-dark text-white text-sm font-medium px-4 py-2 rounded-md transition-colors disabled:opacity-60"
          >
            {saving ? "Criando..." : "Criar e mudar para esta obra"}
          </button>
        </form>
      </Modal>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-col border-r border-line bg-card min-h-screen sticky top-0">
        <OrgSwitcher />
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-blueprint text-white"
                    : "text-ink-soft hover:bg-paper hover:text-ink"
                }`}
              >
                <Icon size={17} strokeWidth={2} />
                {label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={() => supabase.auth.signOut()}
          className="mx-3 mb-4 flex items-center gap-3 rounded-md px-3 py-2 text-sm text-ink-soft hover:bg-paper hover:text-safety transition-colors"
        >
          <LogOut size={17} />
          Sair
        </button>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-card border-t border-line flex py-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 min-w-0 flex flex-col items-center gap-0.5 px-1 py-1 text-[9px] leading-tight ${
                active ? "text-blueprint" : "text-ink-soft"
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2.4 : 2} />
              <span className="truncate max-w-full">{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
