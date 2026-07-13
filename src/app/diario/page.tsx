"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  CloudLightning,
  Users,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Lock,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useOrg } from "@/lib/org-context";
import {
  DailyReport,
  ReportLabor,
  ReportOccurrence,
  WeatherCondition,
  OCCURRENCE_TYPE_LABELS,
} from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";

const WEATHER_ICON: Record<WeatherCondition, React.ComponentType<{ size?: number; className?: string }>> = {
  sol: Sun,
  parcial: CloudSun,
  nublado: Cloud,
  chuva: CloudRain,
  chuva_forte: CloudLightning,
};

function WeatherIcon({ cond, size = 15 }: { cond: WeatherCondition | null; size?: number }) {
  if (!cond) return <span className="text-line">—</span>;
  const Icon = WEATHER_ICON[cond];
  const rainy = cond === "chuva" || cond === "chuva_forte";
  return <Icon size={size} className={rainy ? "text-blueprint" : "text-safety"} />;
}

function weekdayShort(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
}

function monthLabel(dateStr: string) {
  const label = new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function DiarioPage() {
  const router = useRouter();
  const { currentOrgId } = useOrg();
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [labor, setLabor] = useState<ReportLabor[]>([]);
  const [occurrences, setOccurrences] = useState<ReportOccurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickDate, setPickDate] = useState(() => new Date().toISOString().slice(0, 10));

  const today = new Date().toISOString().slice(0, 10);

  async function load() {
    if (!currentOrgId) return;
    setLoading(true);
    const [r, l, o] = await Promise.all([
      supabase.from("daily_reports").select("*").eq("organization_id", currentOrgId).order("report_date", { ascending: false }),
      supabase.from("report_labor").select("*").eq("organization_id", currentOrgId),
      supabase.from("report_occurrences").select("*").eq("organization_id", currentOrgId).order("created_at", { ascending: false }),
    ]);
    setReports(r.data ?? []);
    setLabor(l.data ?? []);
    setOccurrences(o.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [currentOrgId]);

  const laborByReport = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of labor) map[l.report_id] = (map[l.report_id] ?? 0) + l.quantity;
    return map;
  }, [labor]);

  const occByReport = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of occurrences) map[o.report_id] = (map[o.report_id] ?? 0) + 1;
    return map;
  }, [occurrences]);

  const reportById = useMemo(() => {
    const map: Record<string, DailyReport> = {};
    for (const r of reports) map[r.id] = r;
    return map;
  }, [reports]);

  const openPending = occurrences.filter((o) => o.is_pending && !o.resolved);
  const rainyDays = reports.filter(
    (r) =>
      r.weather_morning === "chuva" ||
      r.weather_morning === "chuva_forte" ||
      r.weather_afternoon === "chuva" ||
      r.weather_afternoon === "chuva_forte"
  ).length;
  const stoppedPeriods = reports.reduce(
    (n, r) => n + (r.workable_morning ? 0 : 1) + (r.workable_afternoon ? 0 : 1),
    0
  );
  const todayReport = reports.find((r) => r.report_date === today);

  async function createReport(date: string) {
    if (!currentOrgId) return;
    const existing = reports.find((r) => r.report_date === date);
    if (existing) {
      router.push(`/diario/${existing.id}`);
      return;
    }
    setCreating(true);
    const nextNumber = reports.reduce((max, r) => Math.max(max, r.report_number), 0) + 1;
    const { data, error } = await supabase
      .from("daily_reports")
      .insert({ report_date: date, report_number: nextNumber, organization_id: currentOrgId })
      .select()
      .single();
    setCreating(false);
    if (error || !data) {
      alert("Não foi possível criar o RDO. Verifique se já existe um relatório nesta data.");
      return;
    }
    router.push(`/diario/${data.id}`);
  }

  async function resolvePending(o: ReportOccurrence) {
    await supabase
      .from("report_occurrences")
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq("id", o.id);
    load();
  }

  // agrupa por mês
  const groups = useMemo(() => {
    const map = new Map<string, DailyReport[]>();
    for (const r of reports) {
      const key = r.report_date.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return [...map.entries()];
  }, [reports]);

  return (
    <div>
      <PageHeader
        eyebrow="Registro oficial do canteiro"
        title="Diário de Obra"
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setPickerOpen(true)}
              className="text-sm font-medium px-4 py-2 rounded-md border border-line text-ink-soft hover:text-ink hover:bg-paper transition-colors"
            >
              Outra data
            </button>
            <button
              onClick={() => (todayReport ? router.push(`/diario/${todayReport.id}`) : createReport(today))}
              disabled={creating}
              className="flex items-center gap-2 bg-blueprint hover:bg-blueprint-dark text-white text-sm font-medium px-4 py-2 rounded-md transition-colors disabled:opacity-60"
            >
              <Plus size={16} />
              {todayReport ? "RDO de hoje" : "Abrir RDO de hoje"}
            </button>
          </div>
        }
      />

      <div className="px-6 md:px-10 py-6 space-y-8">
        {/* Resumo */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "RDOs registrados", value: reports.length, icon: BookOpen, tone: "text-blueprint" },
            { label: "Dias com chuva", value: rainyDays, icon: CloudRain, tone: "text-blueprint" },
            { label: "Períodos parados", value: stoppedPeriods, icon: CloudLightning, tone: "text-safety" },
            { label: "Pendências abertas", value: openPending.length, icon: AlertTriangle, tone: openPending.length ? "text-safety" : "text-success" },
          ].map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="bg-card border border-line rounded-lg px-4 py-3 min-w-0">
              <div className="flex items-center gap-2 text-ink-soft">
                <Icon size={14} className={tone} />
                <span className="text-[11px] uppercase tracking-wider font-mono truncate">{label}</span>
              </div>
              <p className="font-mono text-2xl text-ink mt-1">{value}</p>
            </div>
          ))}
        </div>

        {/* Pendências abertas */}
        {openPending.length > 0 && (
          <div className="bg-card border border-safety/40 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-line flex items-center gap-2">
              <AlertTriangle size={15} className="text-safety shrink-0" />
              <h2 className="font-display font-semibold text-ink text-sm">
                Pendências em aberto
              </h2>
            </div>
            <ul className="divide-y divide-line">
              {openPending.map((o) => {
                const rep = reportById[o.report_id];
                return (
                  <li key={o.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink break-words">{o.description}</p>
                      <p className="text-xs text-ink-soft font-mono mt-0.5">
                        {OCCURRENCE_TYPE_LABELS[o.type]}
                        {rep && (
                          <>
                            {" · "}
                            <Link href={`/diario/${rep.id}`} className="underline hover:text-blueprint">
                              RDO nº {String(rep.report_number).padStart(3, "0")} —{" "}
                              {new Date(rep.report_date + "T12:00:00").toLocaleDateString("pt-BR")}
                            </Link>
                          </>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => resolvePending(o)}
                      className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-success border border-line rounded-md px-2.5 py-1.5 hover:bg-paper transition-colors"
                    >
                      <CheckCircle2 size={13} />
                      Resolver
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Timeline */}
        {loading ? (
          <p className="font-mono text-sm text-ink-soft">Carregando…</p>
        ) : reports.length === 0 ? (
          <div className="bg-card border border-dashed border-line rounded-lg px-6 py-14 text-center">
            <BookOpen size={28} className="mx-auto text-blueprint mb-3" />
            <p className="font-display font-semibold text-ink">Nenhum RDO registrado ainda</p>
            <p className="text-sm text-ink-soft mt-1 max-w-md mx-auto">
              O Relatório Diário de Obra é a memória oficial do canteiro: clima, equipe,
              atividades, ocorrências e fotos de cada dia. Abra o primeiro para começar o histórico.
            </p>
            <button
              onClick={() => createReport(today)}
              className="mt-4 inline-flex items-center gap-2 bg-blueprint hover:bg-blueprint-dark text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
            >
              <Plus size={16} />
              Abrir RDO de hoje
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map(([month, list]) => (
              <div key={month}>
                <p className="text-[11px] uppercase tracking-[0.2em] font-mono text-ink-soft mb-2">
                  {monthLabel(list[0].report_date)}
                </p>
                <div className="bg-card border border-line rounded-lg divide-y divide-line overflow-hidden">
                  {list.map((r) => (
                    <Link
                      key={r.id}
                      href={`/diario/${r.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-paper transition-colors min-w-0"
                    >
                      <div className="shrink-0 w-12 text-center">
                        <p className="font-mono text-lg text-ink leading-none">
                          {r.report_date.slice(8, 10)}
                        </p>
                        <p className="text-[10px] uppercase font-mono text-ink-soft">
                          {weekdayShort(r.report_date)}
                        </p>
                      </div>
                      <div className="shrink-0 font-mono text-[11px] text-blueprint border border-blueprint/30 rounded px-1.5 py-0.5">
                        Nº {String(r.report_number).padStart(3, "0")}
                      </div>
                      <div className="flex items-center gap-1 shrink-0" title="Manhã / Tarde">
                        <WeatherIcon cond={r.weather_morning} />
                        <span className="text-line text-xs">/</span>
                        <WeatherIcon cond={r.weather_afternoon} />
                      </div>
                      {(!r.workable_morning || !r.workable_afternoon) && (
                        <span className="shrink-0 text-[10px] font-mono uppercase text-safety border border-safety/40 rounded px-1.5 py-0.5">
                          Impraticável
                        </span>
                      )}
                      <div className="flex-1 min-w-0 hidden sm:block">
                        <p className="text-sm text-ink truncate">
                          {r.summary || <span className="text-ink-soft italic">Sem resumo</span>}
                        </p>
                      </div>
                      <div className="shrink-0 flex items-center gap-3 text-xs font-mono text-ink-soft">
                        <span className="flex items-center gap-1" title="Efetivo">
                          <Users size={13} />
                          {laborByReport[r.id] ?? 0}
                        </span>
                        <span
                          className={`flex items-center gap-1 ${(occByReport[r.id] ?? 0) > 0 ? "text-safety" : ""}`}
                          title="Ocorrências"
                        >
                          <AlertTriangle size={13} />
                          {occByReport[r.id] ?? 0}
                        </span>
                        {r.status === "finalizado" ? (
                          <span className="flex items-center gap-1 text-success" title="Finalizado">
                            <Lock size={12} />
                          </span>
                        ) : (
                          <span className="text-[10px] uppercase border border-line rounded px-1.5 py-0.5">
                            Rascunho
                          </span>
                        )}
                      </div>
                      <ChevronRight size={15} className="shrink-0 text-ink-soft" />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Abrir RDO em outra data">
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">
            Cada dia da obra tem um único RDO. Se já existir um relatório nesta data, ele será aberto.
          </p>
          <input
            type="date"
            value={pickDate}
            max={today}
            onChange={(e) => setPickDate(e.target.value)}
            className="w-full bg-paper border border-line rounded-md px-3 py-2 text-sm font-mono"
          />
          <button
            onClick={() => {
              setPickerOpen(false);
              createReport(pickDate);
            }}
            disabled={creating || !pickDate}
            className="w-full bg-blueprint hover:bg-blueprint-dark text-white text-sm font-medium px-4 py-2 rounded-md transition-colors disabled:opacity-60"
          >
            Abrir RDO
          </button>
        </div>
      </Modal>
    </div>
  );
}
