"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Plus, Pencil, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Activity, ActivityStatus, STATUS_LABELS } from "@/lib/types";
import { formatDate } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import StatusBadge from "@/components/StatusBadge";

export default function AtividadesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ActivityStatus>("planejado");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [plannedStart, setPlannedStart] = useState("");
  const [plannedEnd, setPlannedEnd] = useState("");
  const [saving, setSaving] = useState(false);

  // filtros
  const [filterStatus, setFilterStatus] = useState<ActivityStatus | "">("");
  const [search, setSearch] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("activities")
      .select("*")
      .order("date", { ascending: false });
    setActivities(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openNew() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setStatus("planejado");
    setDate(new Date().toISOString().slice(0, 10));
    setPlannedStart("");
    setPlannedEnd("");
    setOpen(true);
  }

  function openEdit(a: Activity) {
    setEditingId(a.id);
    setTitle(a.title);
    setDescription(a.description ?? "");
    setStatus(a.status);
    setDate(a.date);
    setPlannedStart(a.planned_start ?? "");
    setPlannedEnd(a.planned_end ?? "");
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      title,
      description,
      status,
      date,
      planned_start: plannedStart || null,
      planned_end: plannedEnd || null,
    };
    if (editingId) {
      await supabase.from("activities").update(payload).eq("id", editingId);
    } else {
      await supabase.from("activities").insert(payload);
    }
    setSaving(false);
    setOpen(false);
    load();
  }

  async function updateStatus(id: string, newStatus: ActivityStatus) {
    await supabase.from("activities").update({ status: newStatus }).eq("id", id);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Remover esta atividade?")) return;
    await supabase.from("activities").delete().eq("id", id);
    load();
  }

  function isLate(a: Activity) {
    return a.status !== "concluido" && a.planned_end && a.planned_end < today;
  }

  const filtered = activities.filter((a) => {
    if (filterStatus && a.status !== filterStatus) return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <PageHeader
        eyebrow="Etapas da obra"
        title="Atividades"
        action={
          <button
            onClick={openNew}
            className="flex items-center gap-2 bg-blueprint hover:bg-blueprint-dark text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
          >
            <Plus size={16} /> Nova atividade
          </button>
        }
      />

      <div className="px-6 md:px-10 py-8">
        <div className="flex flex-wrap gap-2 mb-5 max-w-3xl">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título…"
            className="flex-1 min-w-[160px] rounded-md border border-line bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blueprint"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as ActivityStatus | "")}
            className="rounded-md border border-line bg-white px-3 py-1.5 text-sm"
          >
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-ink-soft text-sm font-mono">Carregando…</p>
        ) : filtered.length === 0 ? (
          <p className="text-ink-soft text-sm">
            {activities.length === 0
              ? "Nenhuma atividade registrada ainda. Comece adicionando a primeira etapa da obra."
              : "Nenhuma atividade encontrada com esses filtros."}
          </p>
        ) : (
          <div className="space-y-3 max-w-3xl">
            {filtered.map((a) => {
              const late = isLate(a);
              return (
                <div
                  key={a.id}
                  className={`bg-card border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between min-w-0 ${
                    late ? "border-safety/50" : "border-line"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-ink">{a.title}</h3>
                      <StatusBadge status={a.status} />
                      {late && (
                        <span className="inline-flex items-center gap-1 text-xs text-safety">
                          <AlertTriangle size={12} /> Atrasada
                        </span>
                      )}
                    </div>
                    {a.description && (
                      <p className="text-sm text-ink-soft mt-1">{a.description}</p>
                    )}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-soft font-mono mt-1">
                      <span>{formatDate(a.date)}</span>
                      {(a.planned_start || a.planned_end) && (
                        <span>
                          Previsto: {a.planned_start ? formatDate(a.planned_start) : "?"} →{" "}
                          {a.planned_end ? formatDate(a.planned_end) : "?"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={a.status}
                      onChange={(e) =>
                        updateStatus(a.id, e.target.value as ActivityStatus)
                      }
                      className="text-xs border border-line rounded-md px-2 py-1.5 bg-white"
                    >
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => openEdit(a)}
                      className="text-ink-soft hover:text-blueprint"
                      aria-label="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => remove(a.id)}
                      className="text-xs text-ink-soft hover:text-safety"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? "Editar atividade" : "Nova atividade"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-ink-soft mb-1">Título</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Fundação, Elétrica, Acabamento..."
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blueprint"
            />
          </div>
          <div>
            <label className="block text-sm text-ink-soft mb-1">
              Descrição (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blueprint"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-ink-soft mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ActivityStatus)}
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-ink-soft mb-1">Data do registro</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-ink-soft mb-1">
                Início previsto
              </label>
              <input
                type="date"
                value={plannedStart}
                onChange={(e) => setPlannedStart(e.target.value)}
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-ink-soft mb-1">
                Fim previsto
              </label>
              <input
                type="date"
                value={plannedEnd}
                onChange={(e) => setPlannedEnd(e.target.value)}
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blueprint hover:bg-blueprint-dark text-white font-medium py-2.5 rounded-md transition-colors disabled:opacity-60"
          >
            {saving ? "Salvando…" : editingId ? "Salvar alterações" : "Salvar atividade"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
