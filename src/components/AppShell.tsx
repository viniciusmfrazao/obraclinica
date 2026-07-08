"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session, loading } = useAuth();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper bg-blueprint-grid">
        <p className="font-mono text-sm text-ink-soft">Carregando…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
    </div>
  );
}
