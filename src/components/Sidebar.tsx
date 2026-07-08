"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListChecks,
  Wallet,
  FileText,
  Images,
  ShoppingCart,
  LogOut,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const NAV = [
  { href: "/", label: "Painel", icon: LayoutDashboard },
  { href: "/atividades", label: "Atividades", icon: ListChecks },
  { href: "/pagamentos", label: "Pagamentos", icon: Wallet },
  { href: "/lista-compras", label: "Compras", icon: ShoppingCart },
  { href: "/documentos", label: "Documentos", icon: FileText },
  { href: "/fotos", label: "Fotos", icon: Images },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-col border-r border-line bg-card min-h-screen sticky top-0">
        <div className="px-6 py-6 border-b border-line">
          <p className="text-[10px] tracking-[0.2em] text-blueprint font-mono uppercase">
            Diário de obra
          </p>
          <h1 className="text-lg font-display font-semibold text-ink">
            ObraClínica
          </h1>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
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
          const active = pathname === href;
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
