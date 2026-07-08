"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Plus, Camera } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Photo } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { useActivities } from "@/lib/use-activities";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";

export default function FotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const activities = useActivities();

  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [activityId, setActivityId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("photos")
      .select("*")
      .order("date", { ascending: false });
    setPhotos(data ?? []);

    if (data) {
      const entries = await Promise.all(
        data.map(async (p) => {
          const { data: signed } = await supabase.storage
            .from("photos")
            .createSignedUrl(p.photo_path, 3600);
          return [p.id, signed?.signedUrl ?? ""] as const;
        })
      );
      setUrls(Object.fromEntries(entries));
    }
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
    const { error } = await supabase.storage.from("photos").upload(path, file);

    if (!error) {
      await supabase.from("photos").insert({
        description: description || null,
        date,
        activity_id: activityId || null,
        photo_path: path,
      });
    }

    setSaving(false);
    setOpen(false);
    setDescription("");
    setFile(null);
    setActivityId("");
    load();
  }

  async function remove(id: string, path: string) {
    if (!confirm("Remover esta foto?")) return;
    await supabase.storage.from("photos").remove([path]);
    await supabase.from("photos").delete().eq("id", id);
    load();
  }

  return (
    <div>
      <PageHeader
        eyebrow="Progresso registrado em imagens"
        title="Fotos"
        action={
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 bg-blueprint hover:bg-blueprint-dark text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
          >
            <Plus size={16} /> Nova foto
          </button>
        }
      />

      <div className="px-6 md:px-10 py-8">
        {loading ? (
          <p className="text-ink-soft text-sm font-mono">Carregando…</p>
        ) : photos.length === 0 ? (
          <p className="text-ink-soft text-sm">Nenhuma foto enviada ainda.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-w-5xl">
            {photos.map((p) => (
              <div
                key={p.id}
                className="bg-card border border-line rounded-lg overflow-hidden group"
              >
                <div className="aspect-square bg-line/30 relative">
                  {urls[p.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={urls[p.id]}
                      alt={p.description ?? "Foto da obra"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Camera size={20} className="text-ink-soft" />
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  {p.description && (
                    <p className="text-xs text-ink truncate">{p.description}</p>
                  )}
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[10px] text-ink-soft font-mono">
                      {formatDate(p.date)}
                    </p>
                    <button
                      onClick={() => remove(p.id, p.photo_path)}
                      className="text-[10px] text-ink-soft hover:text-safety"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Nova foto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-ink-soft mb-1">Foto</label>
            <input
              required
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-ink-soft"
            />
          </div>
          <div>
            <label className="block text-sm text-ink-soft mb-1">
              Descrição (opcional)
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Parede da recepção levantada"
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blueprint"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-ink-soft mb-1">Data</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-ink-soft mb-1">
                Atividade
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
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blueprint hover:bg-blueprint-dark text-white font-medium py-2.5 rounded-md transition-colors disabled:opacity-60"
          >
            {saving ? "Enviando…" : "Salvar foto"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
