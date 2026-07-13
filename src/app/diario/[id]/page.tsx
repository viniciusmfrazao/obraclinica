"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  CloudLightning,
  CloudDownload,
  Users,
  Wrench,
  HardHat,
  AlertTriangle,
  Package,
  Camera,
  Printer,
  Lock,
  Unlock,
  Plus,
  Trash2,
  CheckCircle2,
  Copy,
  PenLine,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useOrg } from "@/lib/org-context";
import {
  Activity,
  DailyReport,
  Photo,
  ReportActivity,
  ReportActivityStatus,
  ReportEquipment,
  ReportLabor,
  ReportMaterial,
  ReportOccurrence,
  OccurrenceType,
  WeatherCondition,
  WEATHER_LABELS,
  REPORT_ACTIVITY_STATUS_LABELS,
  OCCURRENCE_TYPE_LABELS,
} from "@/lib/types";
import { fetchDayWeather } from "@/lib/weather";
import Modal from "@/components/Modal";

const OBRA_NOME = "Construção da Clínica";
const OBRA_LOCAL = "Uberlândia / MG";

const WEATHER_OPTIONS: { value: WeatherCondition; icon: React.ComponentType<{ size?: number }> }[] = [
  { value: "sol", icon: Sun },
  { value: "parcial", icon: CloudSun },
  { value: "nublado", icon: Cloud },
  { value: "chuva", icon: CloudRain },
  { value: "chuva_forte", icon: CloudLightning },
];

const inputCls =
  "bg-paper border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blueprint disabled:opacity-60";

function SectionCard({
  number,
  title,
  icon: Icon,
  children,
  aside,
}: {
  number: string;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="bg-card border border-line rounded-lg overflow-hidden no-print">
      <div className="px-4 py-3 border-b border-line flex items-center gap-2.5 flex-wrap">
        <span className="font-mono text-[11px] text-blueprint border border-blueprint/30 rounded px-1.5 py-0.5 shrink-0">
          {number}
        </span>
        <Icon size={15} className="text-ink-soft shrink-0" />
        <h2 className="font-display font-semibold text-ink text-sm flex-1 min-w-0">{title}</h2>
        {aside}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default function RdoDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { currentOrgId } = useOrg();
  const id = params?.id;

  const [report, setReport] = useState<DailyReport | null>(null);
  const [labor, setLabor] = useState<ReportLabor[]>([]);
  const [equipment, setEquipment] = useState<ReportEquipment[]>([]);
  const [rActivities, setRActivities] = useState<ReportActivity[]>([]);
  const [occurrences, setOccurrences] = useState<ReportOccurrence[]>([]);
  const [materials, setMaterials] = useState<ReportMaterial[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [fetchingWeather, setFetchingWeather] = useState(false);
  const [uploading, setUploading] = useState(false);

  // formulários inline
  const [laborRole, setLaborRole] = useState("");
  const [laborQty, setLaborQty] = useState("1");
  const [equipName, setEquipName] = useState("");
  const [equipQty, setEquipQty] = useState("1");
  const [actDesc, setActDesc] = useState("");
  const [actLink, setActLink] = useState("");
  const [actStatus, setActStatus] = useState<ReportActivityStatus>("em_andamento");
  const [actProgress, setActProgress] = useState("0");
  const [occType, setOccType] = useState<OccurrenceType>("outros");
  const [occDesc, setOccDesc] = useState("");
  const [occPending, setOccPending] = useState(false);
  const [matName, setMatName] = useState("");
  const [matQty, setMatQty] = useState("");
  const [matSupplier, setMatSupplier] = useState("");

  // finalização
  const [signOpen, setSignOpen] = useState(false);
  const [signName, setSignName] = useState("Vinicius");

  const locked = report?.status === "finalizado";

  const load = useCallback(async () => {
    if (!id || !currentOrgId) return;
    const [r, l, e, ra, o, m, a] = await Promise.all([
      supabase.from("daily_reports").select("*").eq("id", id).single(),
      supabase.from("report_labor").select("*").eq("report_id", id).order("created_at"),
      supabase.from("report_equipment").select("*").eq("report_id", id).order("created_at"),
      supabase.from("report_activities").select("*").eq("report_id", id).order("created_at"),
      supabase.from("report_occurrences").select("*").eq("report_id", id).order("created_at"),
      supabase.from("report_materials").select("*").eq("report_id", id).order("created_at"),
      supabase.from("activities").select("*").eq("organization_id", currentOrgId).order("date", { ascending: false }),
    ]);
    setReport(r.data ?? null);
    setLabor(l.data ?? []);
    setEquipment(e.data ?? []);
    setRActivities(ra.data ?? []);
    setOccurrences(o.data ?? []);
    setMaterials(m.data ?? []);
    setActivities(a.data ?? []);

    if (r.data) {
      const { data: ph } = await supabase
        .from("photos")
        .select("*")
        .eq("organization_id", currentOrgId)
        .eq("date", r.data.report_date)
        .order("created_at");
      setPhotos(ph ?? []);
      const entries = await Promise.all(
        (ph ?? []).map(async (p) => {
          const { data: signed } = await supabase.storage
            .from("photos")
            .createSignedUrl(p.photo_path, 3600);
          return [p.id, signed?.signedUrl ?? ""] as const;
        })
      );
      setPhotoUrls(Object.fromEntries(entries));
    }
    setLoading(false);
  }, [id, currentOrgId]);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(fields: Partial<DailyReport>) {
    if (!report) return;
    setReport({ ...report, ...fields });
    await supabase.from("daily_reports").update(fields).eq("id", report.id);
  }

  async function autoWeather() {
    if (!report) return;
    setFetchingWeather(true);
    const w = await fetchDayWeather(report.report_date);
    setFetchingWeather(false);
    if (!w) {
      alert("Não foi possível buscar o clima para esta data.");
      return;
    }
    patch({
      weather_morning: w.morning,
      weather_afternoon: w.afternoon,
      temp_min: w.tempMin,
      temp_max: w.tempMax,
      rain_mm: w.rainMm,
    });
  }

  async function copyFromPrevious(kind: "labor" | "equipment") {
    if (!report || !currentOrgId) return;
    const { data: prev } = await supabase
      .from("daily_reports")
      .select("id")
      .eq("organization_id", currentOrgId)
      .lt("report_date", report.report_date)
      .order("report_date", { ascending: false })
      .limit(1)
      .single();
    if (!prev) {
      alert("Nenhum RDO anterior encontrado.");
      return;
    }
    const table = kind === "labor" ? "report_labor" : "report_equipment";
    const { data: rows } = await supabase.from(table).select("*").eq("report_id", prev.id);
    if (!rows || rows.length === 0) {
      alert("O RDO anterior não tem registros nesta seção.");
      return;
    }
    const payload = rows.map((row) =>
      kind === "labor"
        ? { report_id: report.id, role: row.role, quantity: row.quantity, note: row.note, organization_id: currentOrgId }
        : { report_id: report.id, name: row.name, quantity: row.quantity, note: row.note, organization_id: currentOrgId }
    );
    await supabase.from(table).insert(payload);
    load();
  }

  async function addRow(table: string, payload: Record<string, unknown>, reset: () => void) {
    if (!report || !currentOrgId) return;
    await supabase.from(table).insert({ report_id: report.id, organization_id: currentOrgId, ...payload });
    reset();
    load();
  }

  async function removeRow(table: string, rowId: string) {
    await supabase.from(table).delete().eq("id", rowId);
    load();
  }

  async function uploadPhotos(files: FileList | null) {
    if (!files || !report || !currentOrgId) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const path = `${currentOrgId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("photos").upload(path, file);
      if (!error) {
        await supabase.from("photos").insert({
          description: `RDO nº ${String(report.report_number).padStart(3, "0")}`,
          date: report.report_date,
          photo_path: path,
          organization_id: currentOrgId,
        });
      }
    }
    setUploading(false);
    load();
  }


  async function finalize() {
    if (!signName.trim()) return;
    setSignOpen(false);
    await patch({
      status: "finalizado",
      signed_by: signName.trim(),
      finalized_at: new Date().toISOString(),
    });
  }

  const totalWorkers = labor.reduce((n, l) => n + l.quantity, 0);
  const linkedActivityTitle = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of activities) map[a.id] = a.title;
    return map;
  }, [activities]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="font-mono text-sm text-ink-soft">Carregando RDO…</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="px-6 md:px-10 py-10">
        <p className="text-ink-soft text-sm">RDO não encontrado.</p>
        <Link href="/diario" className="text-blueprint text-sm underline mt-2 inline-block">
          Voltar ao diário
        </Link>
      </div>
    );
  }

  const dateLong = new Date(report.report_date + "T12:00:00").toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const numStr = String(report.report_number).padStart(3, "0");

  return (
    <div>
      {/* Cabeçalho */}
      <div className="bg-blueprint-grid border-b border-line bg-card px-6 md:px-10 py-6 no-print">
        <button
          onClick={() => router.push("/diario")}
          className="flex items-center gap-1.5 text-xs font-mono text-ink-soft hover:text-ink mb-3"
        >
          <ArrowLeft size={13} />
          Diário de Obra
        </button>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-xs tracking-[0.2em] text-blueprint font-mono uppercase mb-1">
              Relatório diário de obra · Nº {numStr}
            </p>
            <h1 className="text-2xl md:text-3xl font-display font-semibold text-ink capitalize break-words">
              {dateLong}
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-md border border-line text-ink-soft hover:text-ink hover:bg-paper transition-colors"
            >
              <Printer size={15} />
              Imprimir / PDF
            </button>
            {locked ? (
              <button
                onClick={() => patch({ status: "rascunho", signed_by: null, finalized_at: null })}
                className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-md border border-line text-ink-soft hover:text-safety hover:bg-paper transition-colors"
              >
                <Unlock size={15} />
                Reabrir
              </button>
            ) : (
              <button
                onClick={() => setSignOpen(true)}
                className="flex items-center gap-2 bg-blueprint hover:bg-blueprint-dark text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
              >
                <PenLine size={15} />
                Finalizar e assinar
              </button>
            )}
          </div>
        </div>
        {locked && (
          <div className="mt-4 inline-flex items-center gap-2 border-2 border-success text-success rounded px-3 py-1.5 font-mono text-xs uppercase tracking-widest -rotate-1">
            <Lock size={13} />
            Finalizado · {report.signed_by} ·{" "}
            {report.finalized_at &&
              new Date(report.finalized_at).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
          </div>
        )}
      </div>

      <div className="px-6 md:px-10 py-6 space-y-5 max-w-4xl no-print">
        {/* 01 Clima */}
        <SectionCard
          number="01"
          title="Condições climáticas"
          icon={CloudSun}
          aside={
            !locked && (
              <button
                onClick={autoWeather}
                disabled={fetchingWeather}
                className="flex items-center gap-1.5 text-xs font-medium text-blueprint border border-blueprint/30 rounded-md px-2.5 py-1.5 hover:bg-paper transition-colors disabled:opacity-60"
              >
                <CloudDownload size={13} />
                {fetchingWeather ? "Buscando…" : "Buscar clima do dia"}
              </button>
            )
          }
        >
          <div className="grid sm:grid-cols-2 gap-4">
            {(["morning", "afternoon"] as const).map((period) => {
              const cond = period === "morning" ? report.weather_morning : report.weather_afternoon;
              const workable = period === "morning" ? report.workable_morning : report.workable_afternoon;
              const condField = period === "morning" ? "weather_morning" : "weather_afternoon";
              const workField = period === "morning" ? "workable_morning" : "workable_afternoon";
              return (
                <div key={period} className="border border-line rounded-md p-3 bg-paper/60">
                  <p className="text-[11px] uppercase tracking-wider font-mono text-ink-soft mb-2">
                    {period === "morning" ? "Manhã" : "Tarde"}
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    {WEATHER_OPTIONS.map(({ value, icon: Icon }) => (
                      <button
                        key={value}
                        disabled={locked}
                        title={WEATHER_LABELS[value]}
                        onClick={() => patch({ [condField]: value } as Partial<DailyReport>)}
                        className={`p-2 rounded-md border transition-colors disabled:opacity-60 ${
                          cond === value
                            ? "border-blueprint bg-blueprint text-white"
                            : "border-line text-ink-soft hover:text-ink hover:bg-card"
                        }`}
                      >
                        <Icon size={17} />
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-ink-soft mt-1.5 h-4">{cond ? WEATHER_LABELS[cond] : ""}</p>
                  <label className="flex items-center gap-2 mt-2 text-sm text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={locked}
                      checked={workable}
                      onChange={(e) => patch({ [workField]: e.target.checked } as Partial<DailyReport>)}
                    />
                    Praticável para trabalho
                  </label>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
            {[
              { label: "Mín (°C)", key: "temp_min" as const },
              { label: "Máx (°C)", key: "temp_max" as const },
              { label: "Chuva (mm)", key: "rain_mm" as const },
            ].map(({ label, key }) => (
              <div key={key} className="min-w-0">
                <label className="text-[11px] uppercase font-mono text-ink-soft">{label}</label>
                <input
                  type="number"
                  step="0.1"
                  disabled={locked}
                  defaultValue={report[key] ?? ""}
                  onBlur={(e) =>
                    patch({ [key]: e.target.value === "" ? null : Number(e.target.value) } as Partial<DailyReport>)
                  }
                  className={`${inputCls} w-full font-mono mt-1`}
                />
              </div>
            ))}
            {[
              { label: "Início", key: "work_start" as const },
              { label: "Término", key: "work_end" as const },
            ].map(({ label, key }) => (
              <div key={key} className="min-w-0">
                <label className="text-[11px] uppercase font-mono text-ink-soft">{label}</label>
                <input
                  type="time"
                  disabled={locked}
                  defaultValue={report[key] ?? ""}
                  onBlur={(e) => patch({ [key]: e.target.value || null } as Partial<DailyReport>)}
                  className={`${inputCls} w-full font-mono mt-1`}
                />
              </div>
            ))}
          </div>
        </SectionCard>

        {/* 02 Efetivo */}
        <SectionCard
          number="02"
          title={`Efetivo em obra${totalWorkers ? ` · ${totalWorkers} pessoa${totalWorkers > 1 ? "s" : ""}` : ""}`}
          icon={HardHat}
          aside={
            !locked && (
              <button
                onClick={() => copyFromPrevious("labor")}
                className="flex items-center gap-1.5 text-xs font-medium text-ink-soft border border-line rounded-md px-2.5 py-1.5 hover:bg-paper hover:text-ink transition-colors"
              >
                <Copy size={13} />
                Copiar do RDO anterior
              </button>
            )
          }
        >
          {labor.length > 0 && (
            <ul className="divide-y divide-line border border-line rounded-md mb-3">
              {labor.map((l) => (
                <li key={l.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="font-mono text-sm text-blueprint w-8 shrink-0">{l.quantity}×</span>
                  <span className="text-sm text-ink flex-1 min-w-0 truncate">
                    {l.role}
                    {l.note && <span className="text-ink-soft"> — {l.note}</span>}
                  </span>
                  {!locked && (
                    <button
                      onClick={() => removeRow("report_labor", l.id)}
                      className="text-ink-soft hover:text-safety shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!locked && (
            <div className="flex gap-2 flex-wrap">
              <input
                placeholder="Função (ex.: pedreiro, servente…)"
                value={laborRole}
                onChange={(e) => setLaborRole(e.target.value)}
                className={`${inputCls} flex-1 min-w-[160px]`}
              />
              <input
                type="number"
                min={1}
                value={laborQty}
                onChange={(e) => setLaborQty(e.target.value)}
                className={`${inputCls} w-20 font-mono`}
              />
              <button
                disabled={!laborRole.trim()}
                onClick={() =>
                  addRow(
                    "report_labor",
                    { role: laborRole.trim(), quantity: Math.max(1, Number(laborQty) || 1) },
                    () => {
                      setLaborRole("");
                      setLaborQty("1");
                    }
                  )
                }
                className="bg-blueprint hover:bg-blueprint-dark text-white rounded-md px-3 disabled:opacity-50"
              >
                <Plus size={16} />
              </button>
            </div>
          )}
        </SectionCard>

        {/* 03 Equipamentos */}
        <SectionCard
          number="03"
          title="Equipamentos"
          icon={Wrench}
          aside={
            !locked && (
              <button
                onClick={() => copyFromPrevious("equipment")}
                className="flex items-center gap-1.5 text-xs font-medium text-ink-soft border border-line rounded-md px-2.5 py-1.5 hover:bg-paper hover:text-ink transition-colors"
              >
                <Copy size={13} />
                Copiar do RDO anterior
              </button>
            )
          }
        >
          {equipment.length > 0 && (
            <ul className="divide-y divide-line border border-line rounded-md mb-3">
              {equipment.map((eq) => (
                <li key={eq.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="font-mono text-sm text-blueprint w-8 shrink-0">{eq.quantity}×</span>
                  <span className="text-sm text-ink flex-1 min-w-0 truncate">
                    {eq.name}
                    {eq.note && <span className="text-ink-soft"> — {eq.note}</span>}
                  </span>
                  {!locked && (
                    <button
                      onClick={() => removeRow("report_equipment", eq.id)}
                      className="text-ink-soft hover:text-safety shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!locked && (
            <div className="flex gap-2 flex-wrap">
              <input
                placeholder="Equipamento (ex.: betoneira, andaime…)"
                value={equipName}
                onChange={(e) => setEquipName(e.target.value)}
                className={`${inputCls} flex-1 min-w-[160px]`}
              />
              <input
                type="number"
                min={1}
                value={equipQty}
                onChange={(e) => setEquipQty(e.target.value)}
                className={`${inputCls} w-20 font-mono`}
              />
              <button
                disabled={!equipName.trim()}
                onClick={() =>
                  addRow(
                    "report_equipment",
                    { name: equipName.trim(), quantity: Math.max(1, Number(equipQty) || 1) },
                    () => {
                      setEquipName("");
                      setEquipQty("1");
                    }
                  )
                }
                className="bg-blueprint hover:bg-blueprint-dark text-white rounded-md px-3 disabled:opacity-50"
              >
                <Plus size={16} />
              </button>
            </div>
          )}
        </SectionCard>

        {/* 04 Atividades executadas */}
        <SectionCard number="04" title="Atividades executadas" icon={Users}>
          {rActivities.length > 0 && (
            <ul className="divide-y divide-line border border-line rounded-md mb-3">
              {rActivities.map((ra) => (
                <li key={ra.id} className="px-3 py-2.5">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink break-words">{ra.description}</p>
                      <p className="text-xs font-mono text-ink-soft mt-0.5">
                        {REPORT_ACTIVITY_STATUS_LABELS[ra.status]} · {ra.progress}%
                        {ra.activity_id && linkedActivityTitle[ra.activity_id] && (
                          <> · Etapa: {linkedActivityTitle[ra.activity_id]}</>
                        )}
                      </p>
                      <div className="h-1.5 bg-paper border border-line rounded-full mt-1.5 overflow-hidden">
                        <div
                          className={`h-full ${ra.status === "paralisada" ? "bg-safety" : "bg-blueprint"}`}
                          style={{ width: `${ra.progress}%` }}
                        />
                      </div>
                    </div>
                    {!locked && (
                      <button
                        onClick={() => removeRow("report_activities", ra.id)}
                        className="text-ink-soft hover:text-safety shrink-0 mt-0.5"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {!locked && (
            <div className="space-y-2">
              <input
                placeholder="O que foi executado hoje?"
                value={actDesc}
                onChange={(e) => setActDesc(e.target.value)}
                className={`${inputCls} w-full`}
              />
              <div className="flex gap-2 flex-wrap">
                <select
                  value={actLink}
                  onChange={(e) => setActLink(e.target.value)}
                  className={`${inputCls} flex-1 min-w-[140px]`}
                >
                  <option value="">Sem etapa vinculada</option>
                  {activities.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
                <select
                  value={actStatus}
                  onChange={(e) => setActStatus(e.target.value as ReportActivityStatus)}
                  className={`${inputCls} min-w-[130px]`}
                >
                  {Object.entries(REPORT_ACTIVITY_STATUS_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={actProgress}
                    onChange={(e) => setActProgress(e.target.value)}
                    className={`${inputCls} w-20 font-mono`}
                  />
                  <span className="text-sm text-ink-soft">%</span>
                </div>
                <button
                  disabled={!actDesc.trim()}
                  onClick={() =>
                    addRow(
                      "report_activities",
                      {
                        description: actDesc.trim(),
                        activity_id: actLink || null,
                        status: actStatus,
                        progress: Math.min(100, Math.max(0, Number(actProgress) || 0)),
                      },
                      () => {
                        setActDesc("");
                        setActLink("");
                        setActStatus("em_andamento");
                        setActProgress("0");
                      }
                    )
                  }
                  className="bg-blueprint hover:bg-blueprint-dark text-white rounded-md px-3 disabled:opacity-50"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          )}
        </SectionCard>

        {/* 05 Ocorrências */}
        <SectionCard number="05" title="Ocorrências" icon={AlertTriangle}>
          {occurrences.length > 0 && (
            <ul className="divide-y divide-line border border-line rounded-md mb-3">
              {occurrences.map((o) => (
                <li key={o.id} className="px-3 py-2.5 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink break-words">{o.description}</p>
                    <p className="text-xs font-mono mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="text-ink-soft">{OCCURRENCE_TYPE_LABELS[o.type]}</span>
                      {o.is_pending &&
                        (o.resolved ? (
                          <span className="text-success flex items-center gap-1">
                            <CheckCircle2 size={12} /> Resolvida
                          </span>
                        ) : (
                          <span className="text-safety uppercase">Pendência aberta</span>
                        ))}
                    </p>
                  </div>
                  {o.is_pending && !o.resolved && (
                    <button
                      onClick={() =>
                        supabase
                          .from("report_occurrences")
                          .update({ resolved: true, resolved_at: new Date().toISOString() })
                          .eq("id", o.id)
                          .then(() => load())
                      }
                      className="shrink-0 text-xs font-medium text-success border border-line rounded-md px-2 py-1 hover:bg-paper"
                    >
                      Resolver
                    </button>
                  )}
                  {!locked && (
                    <button
                      onClick={() => removeRow("report_occurrences", o.id)}
                      className="text-ink-soft hover:text-safety shrink-0 mt-0.5"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!locked && (
            <div className="space-y-2">
              <textarea
                placeholder="Descreva a ocorrência (visita, atraso, entrega, imprevisto…)"
                value={occDesc}
                onChange={(e) => setOccDesc(e.target.value)}
                rows={2}
                className={`${inputCls} w-full resize-y`}
              />
              <div className="flex gap-2 flex-wrap items-center">
                <select
                  value={occType}
                  onChange={(e) => setOccType(e.target.value as OccurrenceType)}
                  className={`${inputCls} min-w-[160px]`}
                >
                  {Object.entries(OCCURRENCE_TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={occPending}
                    onChange={(e) => setOccPending(e.target.checked)}
                  />
                  Marcar como pendência
                </label>
                <button
                  disabled={!occDesc.trim()}
                  onClick={() =>
                    addRow(
                      "report_occurrences",
                      { type: occType, description: occDesc.trim(), is_pending: occPending },
                      () => {
                        setOccDesc("");
                        setOccType("outros");
                        setOccPending(false);
                      }
                    )
                  }
                  className="ml-auto bg-blueprint hover:bg-blueprint-dark text-white rounded-md px-3 py-2 disabled:opacity-50"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          )}
        </SectionCard>

        {/* 06 Materiais recebidos */}
        <SectionCard number="06" title="Materiais recebidos" icon={Package}>
          {materials.length > 0 && (
            <ul className="divide-y divide-line border border-line rounded-md mb-3">
              {materials.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="text-sm text-ink flex-1 min-w-0 truncate">
                    {m.name}
                    {m.quantity && <span className="font-mono text-blueprint"> · {m.quantity}</span>}
                    {m.supplier && <span className="text-ink-soft"> — {m.supplier}</span>}
                  </span>
                  {!locked && (
                    <button
                      onClick={() => removeRow("report_materials", m.id)}
                      className="text-ink-soft hover:text-safety shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!locked && (
            <div className="flex gap-2 flex-wrap">
              <input
                placeholder="Material"
                value={matName}
                onChange={(e) => setMatName(e.target.value)}
                className={`${inputCls} flex-1 min-w-[140px]`}
              />
              <input
                placeholder="Qtd. (ex.: 50 sacos)"
                value={matQty}
                onChange={(e) => setMatQty(e.target.value)}
                className={`${inputCls} w-36`}
              />
              <input
                placeholder="Fornecedor"
                value={matSupplier}
                onChange={(e) => setMatSupplier(e.target.value)}
                className={`${inputCls} w-36`}
              />
              <button
                disabled={!matName.trim()}
                onClick={() =>
                  addRow(
                    "report_materials",
                    {
                      name: matName.trim(),
                      quantity: matQty.trim() || null,
                      supplier: matSupplier.trim() || null,
                    },
                    () => {
                      setMatName("");
                      setMatQty("");
                      setMatSupplier("");
                    }
                  )
                }
                className="bg-blueprint hover:bg-blueprint-dark text-white rounded-md px-3 disabled:opacity-50"
              >
                <Plus size={16} />
              </button>
            </div>
          )}
        </SectionCard>

        {/* 07 Fotos do dia */}
        <SectionCard
          number="07"
          title={`Fotos do dia${photos.length ? ` · ${photos.length}` : ""}`}
          icon={Camera}
          aside={
            !locked && (
              <label className="flex items-center gap-1.5 text-xs font-medium text-blueprint border border-blueprint/30 rounded-md px-2.5 py-1.5 hover:bg-paper transition-colors cursor-pointer">
                <Plus size={13} />
                {uploading ? "Enviando…" : "Adicionar fotos"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => uploadPhotos(e.target.files)}
                />
              </label>
            )
          }
        >
          {photos.length === 0 ? (
            <p className="text-sm text-ink-soft">
              Nenhuma foto registrada nesta data. Fotos enviadas aqui (ou na aba Fotos, com esta
              data) entram automaticamente como evidência do RDO.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {photos.map((p) =>
                photoUrls[p.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={p.id}
                    src={photoUrls[p.id]}
                    alt={p.description ?? "Foto da obra"}
                    className="aspect-square object-cover rounded-md border border-line"
                  />
                ) : null
              )}
            </div>
          )}
        </SectionCard>

        {/* 08 Resumo e observações */}
        <SectionCard number="08" title="Resumo e observações" icon={PenLine}>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] uppercase font-mono text-ink-soft">Resumo do dia</label>
              <textarea
                disabled={locked}
                defaultValue={report.summary ?? ""}
                onBlur={(e) => patch({ summary: e.target.value || null })}
                rows={2}
                placeholder="Uma linha que resume o dia (aparece na lista do diário)"
                className={`${inputCls} w-full resize-y mt-1`}
              />
            </div>
            <div>
              <label className="text-[11px] uppercase font-mono text-ink-soft">Observações gerais</label>
              <textarea
                disabled={locked}
                defaultValue={report.notes ?? ""}
                onBlur={(e) => patch({ notes: e.target.value || null })}
                rows={4}
                placeholder="Notas livres, decisões tomadas, combinados com fornecedores…"
                className={`${inputCls} w-full resize-y mt-1`}
              />
            </div>
          </div>
        </SectionCard>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* FOLHA DE IMPRESSÃO (documento oficial)                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="rdo-print hidden print:block">
        <table className="rdo-head">
          <tbody>
            <tr>
              <td className="rdo-brand">
                <strong>{OBRA_NOME}</strong>
                <br />
                {OBRA_LOCAL}
              </td>
              <td className="rdo-title">RELATÓRIO DIÁRIO DE OBRA</td>
              <td className="rdo-meta">
                <strong>RDO Nº {numStr}</strong>
                <br />
                {new Date(report.report_date + "T12:00:00").toLocaleDateString("pt-BR")} ·{" "}
                <span style={{ textTransform: "capitalize" }}>
                  {new Date(report.report_date + "T12:00:00").toLocaleDateString("pt-BR", {
                    weekday: "long",
                  })}
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        <h3>1. Condições climáticas</h3>
        <table className="rdo-table">
          <thead>
            <tr>
              <th>Período</th>
              <th>Tempo</th>
              <th>Condição</th>
              <th>Temp. mín/máx</th>
              <th>Chuva</th>
              <th>Expediente</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Manhã</td>
              <td>{report.weather_morning ? WEATHER_LABELS[report.weather_morning] : "—"}</td>
              <td>{report.workable_morning ? "Praticável" : "Impraticável"}</td>
              <td rowSpan={2}>
                {report.temp_min ?? "—"}°C / {report.temp_max ?? "—"}°C
              </td>
              <td rowSpan={2}>{report.rain_mm ?? "—"} mm</td>
              <td rowSpan={2}>
                {report.work_start?.slice(0, 5) ?? "—"} às {report.work_end?.slice(0, 5) ?? "—"}
              </td>
            </tr>
            <tr>
              <td>Tarde</td>
              <td>{report.weather_afternoon ? WEATHER_LABELS[report.weather_afternoon] : "—"}</td>
              <td>{report.workable_afternoon ? "Praticável" : "Impraticável"}</td>
            </tr>
          </tbody>
        </table>

        <h3>2. Efetivo em obra {totalWorkers > 0 && `(total: ${totalWorkers})`}</h3>
        {labor.length === 0 ? (
          <p className="rdo-empty">Sem registro.</p>
        ) : (
          <table className="rdo-table">
            <thead>
              <tr>
                <th style={{ width: "12%" }}>Qtd.</th>
                <th>Função</th>
              </tr>
            </thead>
            <tbody>
              {labor.map((l) => (
                <tr key={l.id}>
                  <td>{l.quantity}</td>
                  <td>
                    {l.role}
                    {l.note ? ` — ${l.note}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h3>3. Equipamentos</h3>
        {equipment.length === 0 ? (
          <p className="rdo-empty">Sem registro.</p>
        ) : (
          <table className="rdo-table">
            <thead>
              <tr>
                <th style={{ width: "12%" }}>Qtd.</th>
                <th>Equipamento</th>
              </tr>
            </thead>
            <tbody>
              {equipment.map((eq) => (
                <tr key={eq.id}>
                  <td>{eq.quantity}</td>
                  <td>
                    {eq.name}
                    {eq.note ? ` — ${eq.note}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h3>4. Atividades executadas</h3>
        {rActivities.length === 0 ? (
          <p className="rdo-empty">Sem registro.</p>
        ) : (
          <table className="rdo-table">
            <thead>
              <tr>
                <th>Descrição</th>
                <th style={{ width: "18%" }}>Situação</th>
                <th style={{ width: "10%" }}>Avanço</th>
              </tr>
            </thead>
            <tbody>
              {rActivities.map((ra) => (
                <tr key={ra.id}>
                  <td>
                    {ra.description}
                    {ra.activity_id && linkedActivityTitle[ra.activity_id]
                      ? ` (etapa: ${linkedActivityTitle[ra.activity_id]})`
                      : ""}
                  </td>
                  <td>{REPORT_ACTIVITY_STATUS_LABELS[ra.status]}</td>
                  <td>{ra.progress}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h3>5. Ocorrências</h3>
        {occurrences.length === 0 ? (
          <p className="rdo-empty">Sem ocorrências no dia.</p>
        ) : (
          <table className="rdo-table">
            <thead>
              <tr>
                <th style={{ width: "20%" }}>Tipo</th>
                <th>Descrição</th>
                <th style={{ width: "16%" }}>Situação</th>
              </tr>
            </thead>
            <tbody>
              {occurrences.map((o) => (
                <tr key={o.id}>
                  <td>{OCCURRENCE_TYPE_LABELS[o.type]}</td>
                  <td>{o.description}</td>
                  <td>{o.is_pending ? (o.resolved ? "Resolvida" : "Pendente") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h3>6. Materiais recebidos</h3>
        {materials.length === 0 ? (
          <p className="rdo-empty">Sem recebimentos no dia.</p>
        ) : (
          <table className="rdo-table">
            <thead>
              <tr>
                <th>Material</th>
                <th style={{ width: "22%" }}>Quantidade</th>
                <th style={{ width: "25%" }}>Fornecedor</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>{m.quantity ?? "—"}</td>
                  <td>{m.supplier ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {(report.summary || report.notes) && (
          <>
            <h3>7. Resumo e observações</h3>
            {report.summary && <p className="rdo-text">{report.summary}</p>}
            {report.notes && <p className="rdo-text">{report.notes}</p>}
          </>
        )}

        {photos.length > 0 && (
          <>
            <h3>8. Registro fotográfico ({photos.length})</h3>
            <div className="rdo-photos">
              {photos.map((p) =>
                photoUrls[p.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={p.id} src={photoUrls[p.id]} alt={p.description ?? "Foto"} />
                ) : null
              )}
            </div>
          </>
        )}

        <div className="rdo-sign">
          <div>
            <div className="rdo-sign-line">
              {report.signed_by ?? ""}
            </div>
            <p>
              Responsável pelo preenchimento
              {report.finalized_at &&
                ` — assinado em ${new Date(report.finalized_at).toLocaleString("pt-BR")}`}
            </p>
          </div>
          <div>
            <div className="rdo-sign-line" />
            <p>Contratante / fiscal</p>
          </div>
        </div>
        <p className="rdo-footer">
          Documento gerado pelo ObraClínica · Diário de Obra digital ·{" "}
          {new Date().toLocaleString("pt-BR")}
        </p>
      </div>

      <Modal open={signOpen} onClose={() => setSignOpen(false)} title="Finalizar e assinar RDO">
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">
            Ao finalizar, o relatório é bloqueado para edição e recebe assinatura eletrônica com
            data e hora. Você pode reabri-lo depois, se precisar.
          </p>
          <div>
            <label className="text-[11px] uppercase font-mono text-ink-soft">
              Nome do responsável
            </label>
            <input
              value={signName}
              onChange={(e) => setSignName(e.target.value)}
              className={`${inputCls} w-full mt-1`}
            />
          </div>
          <button
            onClick={finalize}
            disabled={!signName.trim()}
            className="w-full flex items-center justify-center gap-2 bg-blueprint hover:bg-blueprint-dark text-white text-sm font-medium px-4 py-2 rounded-md transition-colors disabled:opacity-60"
          >
            <Lock size={15} />
            Finalizar RDO nº {numStr}
          </button>
        </div>
      </Modal>
    </div>
  );
}
