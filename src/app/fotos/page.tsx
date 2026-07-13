"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Plus, Camera, LayoutGrid, GitCommitVertical } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useOrg } from "@/lib/org-context";
import { Photo, Activity } from "@/lib/types";
import { formatDate, formatDateLong } from "@/lib/format";
import { useActivities } from "@/lib/use-activities";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import StatusBadge from "@/components/StatusBadge";

type View = "grid" | "timeline";

export default function FotosPage() {
  const { currentOrgId } = useOrg();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [activities, setActivitiesState] = useState<Activity[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("grid");
  const activityOptions = useActivities();

  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [activityId, setActivityId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!currentOrgId) return;
    setLoading(true);
    const [p, a] = await Promise.all([
      supabase.from("photos").select("*").eq("organization_id", currentOrgId).order("date", { ascending: false }),
      supabase.from("activities").select("*").eq("organization_id", currentOrgId).order("date", { ascending: true }),
    ]);
    setPhotos(p.data ?? []);
    setActivitiesState(a.data ?? []);

    if (p.data) {
      const entries = await Promise.all(
        p.data.map(async (item) => {
          const { data: signed } = await supabase.storage
            .from("photos")
            .createSignedUrl(item.photo_path, 3600);
          return [item.id, signed?.signedUrl ?? ""] as const;
        })
      );
      setUrls(Object.fromEntries(entries));
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [currentOrgId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0 || !currentOrgId) return;
    setSaving(true);

    for (const file of files) {
      const path = `${currentOrgId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("photos").upload(path, file);
      if (!error) {
        await supabase.from("photos").insert({
          description: description || null,
          date,
          activity_id: activityId || null,
          photo_path: path,
          organization_id: currentOrgId,
        });
      }
    }

    setSaving(false);
    setOpen(false);
    setDescription("");
    setFiles([]);
    setActivityId("");
    load();
  }

  async function remove(id: string, path: string) {
    if (!confirm("Remover esta foto?")) return;
    await supabase.storage.from("photos").remove([path]);
    await supabase.from("photos").delete().eq("id", id);
    load();
  }

  // Timeline: combina fotos e atividades por data, ordem cronológica (mais antigo primeiro)
  type TimelineEntry =
    | { kind: "photo"; date: string; created_at: string; photo: Photo }
    | { kind: "activity"; date: string; created_at: string; activity: Activity };

  const timelineEntries: TimelineEntry[] = [
    ...photos.map((p) => ({
      kind: "photo" as const,
      date: p.date,
      created_at: p.created_at,
      photo: p,
    })),
    ...activities.map((a) => ({
      kind: "activity" as const,
      date: a.date,
      created_at: a.created_at,
      activity: a,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at));

  return (
    <div>
      <PageHeader
        eyebrow="Progresso registrado em imagens"
        title="Fotos"
        action={
          <div className="flex flex-wrap gap-2">
            <div className="flex bg-card border border-line rounded-md overflow-hidden">
              <button
                onClick={() => setView("grid")}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                  view === "grid" ? "bg-blueprint text-white" : "text-ink-soft hover:text-ink"
                }`}
              >
                <LayoutGrid size={15} /> Grade
              </button>
              <button
                onClick={() => setView("timeline")}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                  view === "timeline" ? "bg-blueprint text-white" : "text-ink-soft hover:text-ink"
                }`}
              >
                <GitCommitVertical size={15} /> Linha do tempo
              </button>
            </div>
            <button
              onClick={() => setOpen(true)}
              className="flex items-center gap-2 bg-blueprint hover:bg-blueprint-dark text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
            >
              <Plus size={16} /> Nova foto
            </button>
          </div>
        }
      />

      <div className="px-6 md:px-10 py-8">
        {loading ? (
          <p className="text-ink-soft text-sm font-mono">Carregando…</p>
        ) : photos.length === 0 ? (
          <p className="text-ink-soft text-sm">Nenhuma foto enviada ainda.</p>
        ) : view === "grid" ? (
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
                  <div className="flex items-center justify-between mt-1 gap-2 min-w-0">
                    <p className="text-[10px] text-ink-soft font-mono shrink-0">
                      {formatDate(p.date)}
                    </p>
                    <button
                      onClick={() => remove(p.id, p.photo_path)}
                      className="text-[10px] text-ink-soft hover:text-safety shrink-0"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="max-w-2xl relative pl-6">
            <div className="absolute left-[9px] top-2 bottom-2 w-px bg-line" />
            <div className="space-y-6">
              {timelineEntries.map((entry, i) => (
                <div key={i} className="relative">
                  <div
                    className={`absolute -left-6 top-1.5 w-[10px] h-[10px] rounded-full border-2 border-paper ${
                      entry.kind === "photo" ? "bg-blueprint" : "bg-safety"
                    }`}
                  />
                  <p className="text-xs font-mono text-ink-soft mb-1.5">
                    {formatDateLong(entry.date)}
                  </p>
                  {entry.kind === "photo" ? (
                    <div className="bg-card border border-line rounded-lg overflow-hidden max-w-xs">
                      <div className="aspect-video bg-line/30 relative">
                        {urls[entry.photo.id] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={urls[entry.photo.id]}
                            alt={entry.photo.description ?? "Foto da obra"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Camera size={18} className="text-ink-soft" />
                          </div>
                        )}
                      </div>
                      {entry.photo.description && (
                        <p className="text-xs text-ink p-2.5">{entry.photo.description}</p>
                      )}
                    </div>
                  ) : (
                    <div className="bg-card border border-line rounded-lg px-3 py-2.5 max-w-xs flex items-center gap-2 min-w-0">
                      <span className="text-sm text-ink truncate flex-1">
                        {entry.activity.title}
                      </span>
                      <span className="shrink-0">
                        <StatusBadge status={entry.activity.status} />
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Nova foto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-ink-soft mb-1">
              Foto{files.length > 1 ? "s" : ""}
            </label>
            <input
              required
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              className="w-full text-sm text-ink-soft"
            />
            {files.length > 1 && (
              <p className="text-[11px] text-ink-soft mt-1">
                {files.length} fotos selecionadas — a descrição e a data valem para todas.
              </p>
            )}
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
                {activityOptions.map((a) => (
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
            {saving
              ? "Enviando…"
              : files.length > 1
                ? `Salvar ${files.length} fotos`
                : "Salvar foto"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
