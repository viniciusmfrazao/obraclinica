"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wallet, ListChecks, FileText, Images, ShoppingCart, ArrowRight, BookOpen, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Activity, Payment, Doc, Photo, ShoppingItem, DailyReport, CATEGORY_LABELS } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";

export default function DashboardPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [shopping, setShopping] = useState<ShoppingItem[]>([]);
  const [todayReport, setTodayReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [a, p, d, f, s, r] = await Promise.all([
        supabase.from("activities").select("*").order("date", { ascending: false }),
        supabase.from("payments").select("*").order("date", { ascending: false }),
        supabase.from("documents").select("*").order("date", { ascending: false }),
        supabase.from("photos").select("*").order("date", { ascending: false }),
        supabase.from("shopping_list_items").select("*"),
        supabase
          .from("daily_reports")
          .select("*")
          .eq("report_date", new Date().toISOString().slice(0, 10))
          .maybeSingle(),
      ]);
      setActivities(a.data ?? []);
      setPayments(p.data ?? []);
      setDocs(d.data ?? []);
      setPhotos(f.data ?? []);
      setShopping(s.data ?? []);
      setTodayReport(r.data ?? null);
      setLoading(false);
    }
    load();
  }, []);

  const totalSpent = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const inProgress = activities.filter((a) => a.status === "em_andamento").length;
  const done = activities.filter((a) => a.status === "concluido").length;

  const byCategory = payments.reduce<Record<string, number>>((acc, p) => {
    acc[p.category] = (acc[p.category] ?? 0) + Number(p.amount);
    return acc;
  }, {});
  const maxCategory = Math.max(1, ...Object.values(byCategory));

  const recentActivity = [
    ...activities.map((a) => ({
      type: "activity" as const,
      date: a.date,
      created_at: a.created_at,
      label: a.title,
      sub: "Atividade",
    })),
    ...payments.map((p) => ({
      type: "payment" as const,
      date: p.date,
      created_at: p.created_at,
      label: `${p.description} - ${formatCurrency(Number(p.amount))}`,
      sub: "Pagamento",
    })),
    ...docs.map((d) => ({
      type: "document" as const,
      date: d.date,
      created_at: d.created_at,
      label: d.name,
      sub: "Documento",
    })),
    ...photos.map((p) => ({
      type: "photo" as const,
      date: p.date,
      created_at: p.created_at,
      label: p.description || "Foto da obra",
      sub: "Foto",
    })),
  ]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 8);

  return (
    <div>
      <PageHeader eyebrow="Visao geral" title="Painel da obra" />

      <div className="px-6 md:px-10 py-8 space-y-8">
        {loading ? (
          <p className="text-ink-soft text-sm font-mono">Carregando...</p>
        ) : (
          <>
            <Link
              href={todayReport ? `/diario/${todayReport.id}` : "/diario"}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors min-w-0 ${
                todayReport?.status === "finalizado"
                  ? "bg-card border-line hover:bg-paper"
                  : "bg-blueprint text-white border-blueprint hover:bg-blueprint-dark"
              }`}
            >
              {todayReport?.status === "finalizado" ? (
                <CheckCircle2 size={18} className="text-success shrink-0" />
              ) : (
                <BookOpen size={18} className="shrink-0" />
              )}
              <span className="text-sm font-medium flex-1 min-w-0 truncate">
                {todayReport
                  ? todayReport.status === "finalizado"
                    ? `RDO de hoje finalizado (nº ${String(todayReport.report_number).padStart(3, "0")})`
                    : "RDO de hoje em rascunho — continuar preenchendo"
                  : "O RDO de hoje ainda não foi aberto — registrar o dia da obra"}
              </span>
              <ArrowRight size={16} className="shrink-0" />
            </Link>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 min-w-0">
              <StatCard
                icon={<Wallet size={16} />}
                label="Total gasto"
                value={formatCurrency(totalSpent)}
                mono
              />
              <StatCard
                icon={<ListChecks size={16} />}
                label="Atividades"
                value={`${done}/${activities.length} concluidas`}
              />
              <StatCard
                icon={<ShoppingCart size={16} />}
                label="Compras pendentes"
                value={String(shopping.filter((s) => !s.done).length)}
              />
              <StatCard
                icon={<FileText size={16} />}
                label="Documentos"
                value={String(docs.length)}
              />
              <StatCard
                icon={<Images size={16} />}
                label="Fotos"
                value={String(photos.length)}
              />
            </div>

            <div className="grid lg:grid-cols-2 gap-6 min-w-0">
              <div className="bg-card border border-line rounded-lg p-5 min-w-0">
                <h2 className="font-display font-semibold text-ink mb-4">
                  Gastos por categoria
                </h2>
                {Object.keys(byCategory).length === 0 ? (
                  <p className="text-sm text-ink-soft">
                    Nenhum pagamento registrado ainda.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(byCategory)
                      .sort((a, b) => b[1] - a[1])
                      .map(([cat, value]) => (
                        <div key={cat} className="min-w-0">
                          <div className="flex justify-between gap-2 text-xs mb-1 min-w-0">
                            <span className="text-ink-soft truncate">
                              {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}
                            </span>
                            <span className="font-mono text-ink shrink-0">
                              {formatCurrency(value)}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-line/50 overflow-hidden">
                            <div
                              className="h-full bg-blueprint rounded-full"
                              style={{ width: `${(value / maxCategory) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="bg-card border border-line rounded-lg p-5 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-4 min-w-0">
                  <h2 className="font-display font-semibold text-ink truncate">
                    Etapas da obra
                  </h2>
                  <Link
                    href="/atividades"
                    className="text-xs text-blueprint hover:underline flex items-center gap-1 shrink-0"
                  >
                    Ver todas <ArrowRight size={12} />
                  </Link>
                </div>
                {activities.length === 0 ? (
                  <p className="text-sm text-ink-soft">
                    Nenhuma atividade registrada ainda.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {activities.slice(0, 5).map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between gap-2 min-w-0"
                      >
                        <span className="text-sm text-ink truncate">
                          {a.title}
                        </span>
                        <span className="shrink-0">
                          <StatusBadge status={a.status} />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {inProgress > 0 && (
                  <p className="text-xs text-safety mt-4 pt-4 border-t border-line">
                    {inProgress} etapa(s) em andamento agora
                  </p>
                )}
              </div>
            </div>

            <div className="bg-card border border-line rounded-lg p-5 min-w-0">
              <h2 className="font-display font-semibold text-ink mb-4">
                Ultimos registros
              </h2>
              {recentActivity.length === 0 ? (
                <p className="text-sm text-ink-soft">
                  Nada por aqui ainda - comece registrando uma atividade,
                  pagamento, documento ou foto.
                </p>
              ) : (
                <ul className="space-y-0">
                  {recentActivity.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-3 py-2.5 border-b border-line/60 last:border-0 min-w-0"
                    >
                      <span className="text-[10px] font-mono uppercase tracking-wide text-blueprint bg-blueprint/10 rounded px-1.5 py-0.5 shrink-0">
                        {item.sub}
                      </span>
                      <span className="text-sm text-ink truncate flex-1 min-w-0">
                        {item.label}
                      </span>
                      <span className="text-xs text-ink-soft font-mono shrink-0">
                        {formatDate(item.date)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="bg-card border border-line rounded-lg p-4 min-w-0">
      <div className="flex items-center gap-1.5 text-ink-soft mb-2 min-w-0">
        {icon}
        <span className="text-xs truncate">{label}</span>
      </div>
      <p
        className={`text-lg font-semibold text-ink truncate ${mono ? "font-mono" : "font-display"}`}
      >
        {value}
      </p>
    </div>
  );
}
