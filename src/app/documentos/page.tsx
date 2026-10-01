"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Plus, FileText, Download, Pencil, FolderPlus, Folder as FolderIcon, UploadCloud } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useOrg } from "@/lib/org-context";
import { Doc, DocumentCategory, DOC_CATEGORY_LABELS, Folder } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { uploadToDocuments } from "@/lib/storage";
import { useActivities } from "@/lib/use-activities";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";

export default function DocumentosPage() {
  const { currentOrgId } = useOrg();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const activities = useActivities();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("nota_fiscal");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [activityId, setActivityId] = useState("");
  const [folderId, setFolderId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [savingFolder, setSavingFolder] = useState(false);

  // filtros
  const [activeFolder, setActiveFolder] = useState<string | "all">("all");
  const [filterCategory, setFilterCategory] = useState<DocumentCategory | "">("");
  const [search, setSearch] = useState("");

  async function load() {
    if (!currentOrgId) return;
    setLoading(true);
    const [d, f] = await Promise.all([
      supabase.from("documents").select("*").eq("organization_id", currentOrgId).order("date", { ascending: false }),
      supabase.from("folders").select("*").eq("organization_id", currentOrgId).order("name"),
    ]);
    setDocs(d.data ?? []);
    setFolders(f.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [currentOrgId]);

  function openNew() {
    setEditingId(null);
    setName("");
    setCategory("nota_fiscal");
    setDate(new Date().toISOString().slice(0, 10));
    setActivityId("");
    setFolderId(activeFolder !== "all" ? activeFolder : "");
    setFiles([]);
    setUploadErrors([]);
    setOpen(true);
  }

  function openWithFiles(list: FileList | File[] | null) {
    const picked = Array.from(list ?? []);
    if (picked.length === 0) return;
    openNew();
    setFiles(picked);
  }

  function openEdit(d: Doc) {
    setEditingId(d.id);
    setName(d.name);
    setCategory(d.category);
    setDate(d.date);
    setActivityId(d.activity_id ?? "");
    setFolderId(d.folder_id ?? "");
    setFiles([]);
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    if (editingId) {
      await supabase
        .from("documents")
        .update({
          name,
          category,
          date,
          activity_id: activityId || null,
          folder_id: folderId || null,
        })
        .eq("id", editingId);
    } else {
      if (files.length === 0 || !currentOrgId) {
        setSaving(false);
        return;
      }
      const errors: string[] = [];
      for (const file of files) {
        const { path, error } = await uploadToDocuments(file, currentOrgId);
        if (!path) {
          errors.push(error ?? `Falha ao enviar "${file.name}".`);
          continue;
        }
        const { error: insertError } = await supabase.from("documents").insert({
          name: files.length === 1 && name.trim() ? name.trim() : file.name,
          category,
          date,
          activity_id: activityId || null,
          folder_id: folderId || null,
          file_path: path,
          organization_id: currentOrgId,
        });
        if (insertError) {
          await supabase.storage.from("documents").remove([path]);
          errors.push(`Não foi possível registrar "${file.name}".`);
        }
      }
      if (errors.length > 0) {
        // mantém o formulário aberto, mostrando só o que falhou
        setUploadErrors(errors);
        setFiles(files.filter((f) => errors.some((m) => m.includes(`"${f.name}"`))));
        setSaving(false);
        load();
        return;
      }
    }

    setSaving(false);
    setOpen(false);
    setName("");
    setFiles([]);
    setUploadErrors([]);
    setActivityId("");
    load();
  }

  async function createFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setSavingFolder(true);
    await supabase.from("folders").insert({ name: newFolderName.trim(), organization_id: currentOrgId });
    setSavingFolder(false);
    setNewFolderName("");
    setFolderModalOpen(false);
    load();
  }

  async function openFile(path: string) {
    const { data } = await supabase.storage.from("documents").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function remove(id: string, path: string) {
    if (!confirm("Remover este documento?")) return;
    await supabase.storage.from("documents").remove([path]);
    await supabase.from("documents").delete().eq("id", id);
    load();
  }

  const filtered = docs.filter((d) => {
    if (activeFolder !== "all" && d.folder_id !== activeFolder) return false;
    if (filterCategory && d.category !== filterCategory) return false;
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <PageHeader
        eyebrow="Contratos, notas e projetos"
        title="Documentos"
        action={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFolderModalOpen(true)}
              className="flex items-center gap-2 bg-card border border-line hover:bg-paper text-ink text-sm font-medium px-4 py-2 rounded-md transition-colors"
            >
              <FolderPlus size={16} /> Nova pasta
            </button>
            <button
              onClick={openNew}
              className="flex items-center gap-2 bg-blueprint hover:bg-blueprint-dark text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
            >
              <UploadCloud size={16} /> Enviar arquivos
            </button>
          </div>
        }
      />

      <div className="px-6 md:px-10 py-8">
        <div className="flex flex-wrap gap-2 mb-4 max-w-4xl">
          <button
            onClick={() => setActiveFolder("all")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
              activeFolder === "all"
                ? "bg-blueprint text-white border-blueprint"
                : "bg-card border-line text-ink-soft hover:text-ink"
            }`}
          >
            Todos
          </button>
          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFolder(f.id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                activeFolder === f.id
                  ? "bg-blueprint text-white border-blueprint"
                  : "bg-card border-line text-ink-soft hover:text-ink"
              }`}
            >
              <FolderIcon size={11} /> {f.name}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-6 max-w-4xl">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome…"
            className="flex-1 min-w-[160px] rounded-md border border-line bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blueprint"
          />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as DocumentCategory | "")}
            className="rounded-md border border-line bg-white px-3 py-1.5 text-sm"
          >
            <option value="">Todas categorias</option>
            {Object.entries(DOC_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            openWithFiles(e.dataTransfer.files);
          }}
          className={`flex flex-col items-center justify-center gap-1.5 text-center rounded-lg border-2 border-dashed px-4 cursor-pointer transition-colors max-w-4xl mb-6 ${
            docs.length === 0 ? "py-10" : "py-5"
          } ${
            dragging
              ? "border-blueprint bg-blueprint/10"
              : "border-line bg-card hover:border-blueprint hover:bg-paper"
          }`}
        >
          <UploadCloud size={docs.length === 0 ? 28 : 20} className="text-blueprint" />
          <span className="text-sm font-medium text-ink">
            Arraste arquivos aqui ou clique para enviar
          </span>
          <span className="text-xs text-ink-soft">
            PDF, imagens, planilhas… vários de uma vez
            {activeFolder !== "all" &&
              ` · vão para a pasta “${folders.find((f) => f.id === activeFolder)?.name ?? ""}”`}
          </span>
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              openWithFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>

        {loading ? (
          <p className="text-ink-soft text-sm font-mono">Carregando…</p>
        ) : filtered.length === 0 ? (
          <p className="text-ink-soft text-sm">
            {docs.length === 0
              ? "Nenhum documento enviado ainda."
              : "Nenhum documento encontrado com esses filtros."}
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl">
            {filtered.map((d) => (
              <div key={d.id} className="bg-card border border-line rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-md bg-blueprint/10 flex items-center justify-center shrink-0">
                    <FileText size={16} className="text-blueprint" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate">{d.name}</p>
                    <p className="text-xs text-ink-soft mt-0.5">
                      {DOC_CATEGORY_LABELS[d.category]} · {formatDate(d.date)}
                    </p>
                    {d.folder_id && (
                      <p className="text-[11px] text-ink-soft mt-0.5 flex items-center gap-1">
                        <FolderIcon size={10} />
                        {folders.find((f) => f.id === d.folder_id)?.name}
                      </p>
                    )}
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
                    onClick={() => openEdit(d)}
                    className="flex items-center gap-1 text-xs text-ink-soft hover:text-blueprint"
                  >
                    <Pencil size={12} /> Editar
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

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? "Editar documento" : "Novo documento"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editingId && (
            <div>
              <label className="block text-sm text-ink-soft mb-1">
                Arquivos (PDF, imagens, planilhas…)
              </label>
              <input
                required={files.length === 0}
                type="file"
                multiple
                onChange={(e) => {
                  setFiles(Array.from(e.target.files ?? []));
                  setUploadErrors([]);
                }}
                className="w-full text-sm text-ink-soft"
              />
              {files.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {files.map((f) => (
                    <li key={f.name + f.size} className="text-xs text-ink flex items-center gap-1.5 min-w-0">
                      <FileText size={12} className="text-blueprint shrink-0" />
                      <span className="truncate">{f.name}</span>
                    </li>
                  ))}
                </ul>
              )}
              {files.length > 1 && (
                <p className="text-[11px] text-ink-soft mt-1">
                  Cada arquivo será salvo com o próprio nome.
                </p>
              )}
              {uploadErrors.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {uploadErrors.map((m) => (
                    <li key={m} className="text-[11px] text-safety">
                      {m}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div>
            <label className="block text-sm text-ink-soft mb-1">
              Nome{!editingId && files.length > 1 ? " (usado só quando é um arquivo)" : ""}
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!editingId && files.length > 1}
              placeholder="Ex: Contrato empreiteiro"
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blueprint"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-ink-soft mb-1">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as DocumentCategory)}
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
            <label className="block text-sm text-ink-soft mb-1">Pasta</label>
            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
            >
              <option value="">Sem pasta</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
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
            {saving
              ? editingId
                ? "Salvando…"
                : "Enviando…"
              : editingId
                ? "Salvar alterações"
                : "Salvar documento"}
          </button>
        </form>
      </Modal>

      <Modal open={folderModalOpen} onClose={() => setFolderModalOpen(false)} title="Nova pasta">
        <form onSubmit={createFolder} className="space-y-4">
          <div>
            <label className="block text-sm text-ink-soft mb-1">Nome da pasta</label>
            <input
              required
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Ex: Projetos, Fotos obra, Alvarás..."
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blueprint"
            />
          </div>
          <button
            type="submit"
            disabled={savingFolder}
            className="w-full bg-blueprint hover:bg-blueprint-dark text-white font-medium py-2.5 rounded-md transition-colors disabled:opacity-60"
          >
            {savingFolder ? "Criando…" : "Criar pasta"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
