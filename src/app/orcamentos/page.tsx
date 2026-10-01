"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, ChevronRight, Trophy } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useOrg } from "@/lib/org-context";
import {
  Quotation,
  QuotationItem,
  QuotationPrice,
  QuotationSupplier,
  QuotationStatus,
  QUOTATION_STATUS_LABELS,
  PaymentCategory,
  CATEGORY_LABELS,
} from "@/lib/types";
import { cheapestSupplierId, supplierTotals } from "@/lib/quotations";
import { formatCurrency, formatDate } from "@/lib/format";
import { useActivities } from "@/lib/use-activities";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";

const STATUS_STYLES: Record<QuotationStatus, string> = {
  aberto: "bg-safety/10 text-safety border-safety/40",
  fechado: "bg-success/10 text-success border-success/40",
  cancelado: "bg-line/40 text-ink-soft border-line",
};

export default function OrcamentosPage() {
  const router = useRouter();
  const { currentOrgId } = useOrg();
  const activities = useActivities();

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [suppliers, setSuppliers] = useState<QuotationSupplier[]>([]);
  const [prices, setPrices] = useState<QuotationPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<QuotationStatus | "todos">("aberto");

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<PaymentCategory>("material");
  const [activityId, setActivityId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!currentOrgId) return;
    setLoading(true);
    const [q, i, s, p] = await Promise.all([
      supabase
        .from("quotations")
        .select("*")
        .eq("organization_id", currentOrgId)
        .order("created_at", { ascending: false }),
      supabase.from("quotation_items").select("*").eq("organization_id", currentOrgId),
      supabase.from("quotation_suppliers").select("*").eq("organization_id", currentOrgId),
      supabase.from("quotation_prices").select("*").eq("organization_id", currentOrgId),
    ]);
    setQuotations(q.data ?? []);
    setItems(i.data ?? []);
    setSuppliers(s.data ?? []);
    setPrices(p.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [currentOrgId]);

  function openNew() {
    setTitle("");
    setCategory("material");
    setActivityId("");
    setNotes("");
    setError(null);
    setOpen(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!currentOrgId) return;
    setSaving(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("quotations")
      .insert({
        title: title.trim(),
        category,
        activity_id: activityId || null,
        notes: notes.trim() || null,
        organization_id: currentOrgId,
      })
      .select()
      .single();
    setSaving(false);
    if (err || !data) {
      setError("Não foi possível criar o orçamento. Tente de novo.");
      return;
    }
    setOpen(false);
    router.push(`/orcamentos/${data.id}`);
  }

  const visible = quotations.filter((q) => filter === "todos" || q.status === filter);
  const openCount = quotations.filter((q) => q.status === "aberto").length;

  function summary(q: Quotation) {
    const qItems = items.filter((i) => i.quotation_id === q.id);
    const qSuppliers = suppliers.filter((s) => s.quotation_id === q.id);
    const qPrices = prices.filter((p) => p.quotation_id === q.id);

    if (q.status === "fechado" && q.chosen_supplier_id) {
      const chosen = qSuppliers.find((s) => s.id === q.chosen_supplier_id);
      if (chosen) {
        const t = supplierTotals(qItems, qPrices, chosen);
        return { line: `${chosen.name} · ${formatCurrency(t.total)}`, best: true };
      }
    }
    const bestId = cheapestSupplierId(qItems, qPrices, qSuppliers);
    const best = qSuppliers.find((s) => s.id === bestId);
    if (best) {
      const t = supplierTotals(qItems, qPrices, best);
      return { line: `Menor preço: ${best.name} · ${formatCurrency(t.total)}`, best: true };
    }
    if (qItems.length === 0) return { line: "Sem itens ainda", best: false };
    if (qSuppliers.length === 0) return { line: "Nenhum fornecedor adicionado", best: false };
    return { line: "Aguardando preços dos fornecedores", best: false };
  }

  return (
    <div>
      <PageHeader
        eyebrow={`${openCount} em cotação`}
        title="Orçamentos"
        action={
          <button
            onClick={openNew}
            className="flex items-center gap-2 bg-blueprint hover:bg-blueprint-dark text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
          >
            <Plus size={16} /> Novo orçamento
          </button>
        }
      />

      <div className="px-6 md:px-10 py-8">
        <p className="text-sm text-ink-soft mb-5 max-w-2xl">
          Antes de comprar, cote o item ou a lista de materiais com alguns fornecedores, compare
          os preços lado a lado e escolha o melhor. Depois é só gerar a conta a pagar.
        </p>

        <div className="flex gap-2 mb-5 flex-wrap">
          {(["aberto", "fechado", "cancelado", "todos"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-sm px-3 py-1.5 rounded-md border transition-colors ${
                filter === f
                  ? "bg-blueprint text-white border-blueprint"
                  : "bg-card text-ink-soft border-line hover:bg-paper"
              }`}
            >
              {f === "todos" ? "Todos" : QUOTATION_STATUS_LABELS[f]}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-ink-soft text-sm font-mono">Carregando…</p>
        ) : visible.length === 0 ? (
          <p className="text-ink-soft text-sm">
            {quotations.length === 0
              ? "Nenhum orçamento ainda. Clique em “Novo orçamento” para começar, por exemplo: cimento."
              : "Nenhum orçamento nesta situação."}
          </p>
        ) : (
          <div className="grid gap-3 max-w-3xl">
            {visible.map((q) => {
              const sm = summary(q);
              const supplierCount = suppliers.filter((s) => s.quotation_id === q.id).length;
              const itemCount = items.filter((i) => i.quotation_id === q.id).length;
              return (
                <Link
                  key={q.id}
                  href={`/orcamentos/${q.id}`}
                  className="bg-card border border-line rounded-lg p-4 flex items-center justify-between gap-3 hover:border-blueprint transition-colors min-w-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h2 className="font-display font-semibold text-ink truncate">{q.title}</h2>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[q.status]}`}
                      >
                        {QUOTATION_STATUS_LABELS[q.status]}
                      </span>
                    </div>
                    <p className="text-xs text-ink-soft font-mono mb-1">
                      {CATEGORY_LABELS[q.category]} · {itemCount} {itemCount === 1 ? "item" : "itens"} ·{" "}
                      {supplierCount} {supplierCount === 1 ? "fornecedor" : "fornecedores"} ·{" "}
                      {formatDate(q.created_at.slice(0, 10))}
                    </p>
                    <p
                      className={`text-sm flex items-center gap-1.5 ${
                        sm.best ? "text-success font-medium" : "text-ink-soft"
                      }`}
                    >
                      {sm.best && <Trophy size={14} className="shrink-0" />}
                      <span className="truncate">{sm.line}</span>
                    </p>
                  </div>
                  <ChevronRight size={18} className="text-ink-soft shrink-0" />
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Novo orçamento">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm text-ink-soft mb-1">O que vai orçar?</label>
            <input
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Cimento, Material elétrico, Piso"
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blueprint"
            />
          </div>
          <div>
            <label className="block text-sm text-ink-soft mb-1">Categoria</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as PaymentCategory)}
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
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
          <div>
            <label className="block text-sm text-ink-soft mb-1">Observações (opcional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: entrega na obra, pagamento em 30 dias"
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-xs text-safety">{error}</p>}
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="w-full bg-blueprint hover:bg-blueprint-dark text-white font-medium py-2.5 rounded-md transition-colors disabled:opacity-60"
          >
            {saving ? "Criando…" : "Criar e adicionar itens"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
