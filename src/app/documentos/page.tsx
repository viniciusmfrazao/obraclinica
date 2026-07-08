"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Plus, FileText, Download } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Doc, DocumentCategory, DOC_CATEGORY_LABELS } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { useActivities } from "@/lib/use-activities";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";

export default function DocumentosPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const activities = useActivities();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("nota_fiscal");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [activityId, setActivityId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("documents")
      .select("*")
      .order("date", { ascending: false });
    setDocs(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setSaving(true);

    const path = `${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("documents").upload(path, file);

    if (!error) {
      await supabase.from("documents").insert({
        name: name || file.name,
        category,
        date,
        activity_id: activityId || null,
        file_path: path,
      });
    }

    setSaving(false);
    setOpen(false);
    setName("");
    setFile(null);
    setActivityId("");
    load();
  }

  async function openFile(path: string) {
    const { data } = await supabase.storage
      .from("documents")
      .createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function remove(id: string, path: string) {
    if (!confirm("Remover este documento?")) return;
    await supabase.storage.from("documents").remove([path]);
    await supabase.from("documents").delete().eq("id", id);
    load();
  }

  return (
    <div>
      <PageHeader
        eyebrow="Contratos, notas e projetos"
        title="Documentos"
        action={
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 bg-blueprint hover:bg-blueprint-dark text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
          >
            <Plus size={16} /> Novo documento
          </button>
        }
      />

      <div className="px-6 md:px-10 py-8">
        {loading ? (
          <p className="text-ink-soft text-sm font-mono">Carregando…</p>
        ) : docs.length === 0 ? (
          <p className="text-ink-soft text-sm">
            Nenhum documento enviado ainda.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl">
            {docs.map((d) => (
              <div
                key={d.id}
                className="bg-card border border-line rounded-lg p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-md bg-blueprint/10 flex items-center justify-center shrink-0">
                    <FileText size={16} className="text-blueprint" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate">
                      {d.name}
                    </p>
                    <p className="text-xs text-ink-soft mt-0.5">
                      {DOC_CATEGORY_LABELS[d.category]} · {formatDate(d.date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={() => openFile(d.file_path)}
                    className="flex items-center gap-1 text-xs text-blueprint hover:underline"
                  >
                    <Download size={12} /> Abrir
                  </button>
                  <button
                    onClick={() => remove(d.id, d.file_path)}
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

      <Modal open={open} onClose={() => setOpen(false)} title="Novo documento">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-ink-soft mb-1">
              Arquivo
            </label>
            <input
              required
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-ink-soft"
            />
          </div>
          <div>
            <label className="block text-sm text-ink-soft mb-1">
              Nome (opcional)
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Contrato empreiteiro"
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blueprint"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-ink-soft mb-1">
                Categoria
              </label>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as DocumentCategory)
                }
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
              >
                {Object.entries(DOC_CATEGORY_LABELS).map(([value, label]) => (
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
          <div>
            <label className="block text-sm text-ink-soft mb-1">
              Atividade relacionada (opcional)
            </label>
            <select
              value={activityId}
              onChange={(e) => setActivityId(e.target.value)}
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
            >
              <option value="">Nenhuma</option>
              {activities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blueprint hover:bg-blueprint-dark text-white font-medium py-2.5 rounded-md transition-colors disabled:opacity-60"
          >
            {saving ? "Enviando…" : "Salvar documento"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
