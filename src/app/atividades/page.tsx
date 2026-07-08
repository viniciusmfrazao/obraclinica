"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Plus, Pencil } from "lucide-react";
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
  const [saving, setSaving] = useState(false);

  // filtros
  const [filterStatus, setFilterStatus] = useState<ActivityStatus | "">("");
  const [search, setSearch] = useState("");

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
    setOpen(true);
  }

  function openEdit(a: Activity) {
    setEditingId(a.id);
    setTitle(a.title);
    setDescription(a.description ?? "");
    setStatus(a.status);
    setDate(a.date);
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    if (editingId) {
      await supabase
        .from("activities")
        .update({ title, description, status, date })
        .eq("id", editingId);
    } else {
      await supabase.from("activities").insert({ title, description, status, date });
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
            {filtered.map((a) => (
              <div
                key={a.id}
                className="bg-card border border-line rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-ink">{a.title}</h3>
                    <StatusBadge status={a.status} />
                  </div>
                  {a.description && (
                    <p className="text-sm text-ink-soft mt-1">{a.description}</p>
                  )}
                  <p className="text-xs text-ink-soft font-mono mt-1">
                    {formatDate(a.date)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
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
            ))}
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
              <label className="block text-sm text-ink-soft mb-1">Data</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
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
