import { supabase } from "./supabase";

// O Storage do Supabase recusa chaves com acentos, espaços e símbolos.
// Mantém o nome legível, mas seguro para o caminho do arquivo.
export function safeFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1) : "";
  const clean = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  const b = clean(base) || "arquivo";
  const e = clean(ext).toLowerCase();
  return e ? `${b}.${e}` : b;
}

export async function uploadToDocuments(
  file: File,
  orgId: string,
  subfolder?: string
): Promise<{ path: string | null; error: string | null }> {
  const folder = subfolder ? `${orgId}/${subfolder}` : orgId;
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safeFileName(file.name)}`;
  const { error } = await supabase.storage.from("documents").upload(path, file, {
    contentType: file.type || undefined,
  });
  if (error) {
    const tooBig = /exceed|too large|maximum/i.test(error.message);
    return {
      path: null,
      error: tooBig
        ? `"${file.name}" é grande demais para enviar.`
        : `Não foi possível enviar "${file.name}": ${error.message}`,
    };
  }
  return { path, error: null };
}

export async function openDocument(path: string) {
  const { data } = await supabase.storage.from("documents").createSignedUrl(path, 60);
  if (data?.signedUrl) window.open(data.signedUrl, "_blank");
}
