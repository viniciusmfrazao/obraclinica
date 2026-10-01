"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Trophy, CheckCircle2, X, Receipt, Paperclip, FileText } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useOrg } from "@/lib/org-context";
import {
  Account,
  Quotation,
  QuotationAttachment,
  QuotationItem,
  QuotationPrice,
  QuotationSupplier,
  QUOTATION_STATUS_LABELS,
  CATEGORY_LABELS,
} from "@/lib/types";
import { cheapestSupplierId, parseMoney, supplierTotals } from "@/lib/quotations";
import { formatCurrency } from "@/lib/format";
import { openDocument, uploadToDocuments } from "@/lib/storage";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";

const SUGGESTED_SUPPLIERS = 3;

function moneyToInput(v: number | null | undefined) {
  return v === null || v === undefined ? "" : String(v).replace(".", ",");
}

function blurOnEnter(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === "Enter") {
    e.preventDefault();
    e.currentTarget.blur();
  }
}

export default function OrcamentoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { currentOrgId } = useOrg();

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [suppliers, setSuppliers] = useState<QuotationSupplier[]>([]);
  const [prices, setPrices] = useState<QuotationPrice[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [attachments, setAttachments] = useState<QuotationAttachment[]>([]);
  const [attachTarget, setAttachTarget] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [supplierSuggestions, setSupplierSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemQty, setNewItemQty] = useState("1");
  const [newItemUnit, setNewItemUnit] = useState("");
  const [newSupplierName, setNewSupplierName] = useState("");

  const [payOpen, setPayOpen] = useState(false);
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payAccountId, setPayAccountId] = useState("");
  const [creatingPayment, setCreatingPayment] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrgId || !id) return;
    const [q, i, s, p, a, pay, inst, att] = await Promise.all([
      supabase.from("quotations").select("*").eq("id", id).eq("organization_id", currentOrgId).maybeSingle(),
      supabase.from("quotation_items").select("*").eq("quotation_id", id).order("position").order("created_at"),
      supabase.from("quotation_suppliers").select("*").eq("quotation_id", id).order("position").order("created_at"),
      supabase.from("quotation_prices").select("*").eq("quotation_id", id),
      supabase.from("accounts").select("*").eq("organization_id", currentOrgId).eq("active", true).order("name"),
      supabase.from("payments").select("supplier").eq("organization_id", currentOrgId),
      supabase.from("installments").select("supplier").eq("organization_id", currentOrgId),
      supabase.from("quotation_attachments").select("*").eq("quotation_id", id).order("created_at"),
    ]);
    if (!q.data) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setQuotation(q.data);
    setItems(i.data ?? []);
    setSuppliers(s.data ?? []);
    setPrices(p.data ?? []);
    setAccounts(a.data ?? []);
    setAttachments(att.data ?? []);

    const seen = new Map<string, string>();
    [...(s.data ?? []).map((x) => x.name), ...(pay.data ?? []).map((x) => x.supplier), ...(inst.data ?? []).map((x) => x.supplier)]
      .filter((n): n is string => !!n && n.trim().length > 0)
      .forEach((n) => {
        const key = n.trim().toLowerCase();
        if (!seen.has(key)) seen.set(key, n.trim());
      });
    setSupplierSuggestions([...seen.values()].sort((x, y) => x.localeCompare(y)));
    setLoading(false);
  }, [currentOrgId, id]);

  useEffect(() => {
    load();
  }, [load]);

  const cheapestId = useMemo(
    () => cheapestSupplierId(items, prices, suppliers),
    [items, prices, suppliers]
  );

  const locked = quotation?.status !== "aberto";

  // ---------------- itens ----------------
  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!quotation || !currentOrgId || !newItemDesc.trim()) return;
    const qty = parseMoney(newItemQty) ?? 1;
    const { data, error: err } = await supabase
      .from("quotation_items")
      .insert({
        organization_id: currentOrgId,
        quotation_id: quotation.id,
        description: newItemDesc.trim(),
        quantity: qty > 0 ? qty : 1,
        unit: newItemUnit.trim() || null,
        position: items.length,
      })
      .select()
      .single();
    if (err || !data) return setError("Não foi possível adicionar o item.");
    setError(null);
    setItems((prev) => [...prev, data]);
    setNewItemDesc("");
    setNewItemQty("1");
    setNewItemUnit("");
  }

  async function updateItem(item: QuotationItem, patch: Partial<QuotationItem>) {
    const { error: err } = await supabase.from("quotation_items").update(patch).eq("id", item.id);
    if (err) return setError("Não foi possível salvar o item.");
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...patch } : i)));
  }

  async function removeItem(item: QuotationItem) {
    if (!confirm(`Remover "${item.description}" e os preços dele?`)) return;
    await supabase.from("quotation_items").delete().eq("id", item.id);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setPrices((prev) => prev.filter((p) => p.item_id !== item.id));
  }

  // ---------------- fornecedores ----------------
  async function addSupplier(e: React.FormEvent) {
    e.preventDefault();
    if (!quotation || !currentOrgId) return;
    const name = newSupplierName.trim();
    if (!name) return;
    if (suppliers.some((s) => s.name.trim().toLowerCase() === name.toLowerCase())) {
      return setError("Esse fornecedor já está neste orçamento.");
    }
    const { data, error: err } = await supabase
      .from("quotation_suppliers")
      .insert({
        organization_id: currentOrgId,
        quotation_id: quotation.id,
        name,
        position: suppliers.length,
      })
      .select()
      .single();
    if (err || !data) return setError("Não foi possível adicionar o fornecedor.");
    setError(null);
    setSuppliers((prev) => [...prev, data]);
    setNewSupplierName("");
  }

  async function updateSupplier(s: QuotationSupplier, patch: Partial<QuotationSupplier>) {
    const { error: err } = await supabase.from("quotation_suppliers").update(patch).eq("id", s.id);
    if (err) return setError("Não foi possível salvar o fornecedor.");
    setSuppliers((prev) => prev.map((x) => (x.id === s.id ? { ...x, ...patch } : x)));
  }

  async function removeSupplier(s: QuotationSupplier) {
    if (!confirm(`Remover ${s.name} deste orçamento?`)) return;
    await supabase.from("quotation_suppliers").delete().eq("id", s.id);
    setSuppliers((prev) => prev.filter((x) => x.id !== s.id));
    setPrices((prev) => prev.filter((p) => p.supplier_id !== s.id));
    setAttachments((prev) => prev.map((a) => (a.supplier_id === s.id ? { ...a, supplier_id: null } : a)));
    if (quotation?.chosen_supplier_id === s.id) {
      setQuotation({ ...quotation, chosen_supplier_id: null, status: "aberto" });
    }
  }

  // ---------------- preços ----------------
  async function savePrice(s: QuotationSupplier, item: QuotationItem, raw: string) {
    if (!quotation || !currentOrgId) return;
    const existing = prices.find((p) => p.supplier_id === s.id && p.item_id === item.id);
    const value = parseMoney(raw);

    if (value === null) {
      if (existing) {
        await supabase.from("quotation_prices").delete().eq("id", existing.id);
        setPrices((prev) => prev.filter((p) => p.id !== existing.id));
      }
      return;
    }
    if (existing && Number(existing.unit_price) === value) return;

    const { data, error: err } = await supabase
      .from("quotation_prices")
      .upsert(
        {
          organization_id: currentOrgId,
          quotation_id: quotation.id,
          supplier_id: s.id,
          item_id: item.id,
          unit_price: value,
        },
        { onConflict: "supplier_id,item_id" }
      )
      .select()
      .single();
    if (err || !data) return setError("Não foi possível salvar o preço.");
    setError(null);
    setPrices((prev) => [...prev.filter((p) => !(p.supplier_id === s.id && p.item_id === item.id)), data]);
  }

  // ---------------- anexos ----------------
  async function uploadAttachments(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !quotation || !currentOrgId) return;
    setUploading(true);
    setUploadErrors([]);
    const errors: string[] = [];
    const added: QuotationAttachment[] = [];
    for (const file of Array.from(fileList)) {
      const { path, error: upErr } = await uploadToDocuments(file, currentOrgId, "orcamentos");
      if (!path) {
        errors.push(upErr ?? `Falha ao enviar "${file.name}".`);
        continue;
      }
      const { data, error: insErr } = await supabase
        .from("quotation_attachments")
        .insert({
          organization_id: currentOrgId,
          quotation_id: quotation.id,
          supplier_id: attachTarget || null,
          name: file.name,
          file_path: path,
        })
        .select()
        .single();
      if (insErr || !data) {
        await supabase.storage.from("documents").remove([path]);
        errors.push(`Não foi possível registrar "${file.name}".`);
        continue;
      }
      added.push(data);
    }
    setAttachments((prev) => [...prev, ...added]);
    setUploadErrors(errors);
    setUploading(false);
  }

  async function removeAttachment(att: QuotationAttachment) {
    if (!confirm(`Remover o arquivo "${att.name}"?`)) return;
    await supabase.storage.from("documents").remove([att.file_path]);
    await supabase.from("quotation_attachments").delete().eq("id", att.id);
    setAttachments((prev) => prev.filter((a) => a.id !== att.id));
  }

  // ---------------- decisão ----------------
  async function setStatus(patch: Partial<Quotation>) {
    if (!quotation) return;
    const { error: err } = await supabase.from("quotations").update(patch).eq("id", quotation.id);
    if (err) return setError("Não foi possível atualizar o orçamento.");
    setError(null);
    setQuotation({ ...quotation, ...patch });
  }

  function choose(s: QuotationSupplier) {
    setStatus({ status: "fechado", chosen_supplier_id: s.id });
  }

  async function deleteQuotation() {
    if (!quotation) return;
    if (!confirm("Excluir este orçamento, os preços e os arquivos anexados?")) return;
    if (attachments.length > 0) {
      await supabase.storage.from("documents").remove(attachments.map((a) => a.file_path));
    }
    await supabase.from("quotations").delete().eq("id", quotation.id);
    router.push("/orcamentos");
  }

  async function createInstallment(e: React.FormEvent) {
    e.preventDefault();
    if (!quotation || !currentOrgId) return;
    const chosen = suppliers.find((s) => s.id === quotation.chosen_supplier_id);
    if (!chosen) return;
    const totals = supplierTotals(items, prices, chosen);
    setCreatingPayment(true);
    const { data, error: err } = await supabase
      .from("installments")
      .insert({
        description: `${quotation.title} — ${chosen.name}`,
        amount: totals.total,
        category: quotation.category,
        supplier: chosen.name,
        account_id: payAccountId || null,
        due_date: dueDate,
        activity_id: quotation.activity_id,
        organization_id: currentOrgId,
      })
      .select()
      .single();
    if (err || !data) {
      setCreatingPayment(false);
      return setError("Não foi possível gerar a conta a pagar.");
    }
    await setStatus({ installment_id: data.id });
    setCreatingPayment(false);
    setPayOpen(false);
  }

  if (loading) {
    return <p className="px-6 md:px-10 py-8 text-ink-soft text-sm font-mono">Carregando…</p>;
  }
  if (notFound || !quotation) {
    return (
      <div className="px-6 md:px-10 py-8">
        <p className="text-ink-soft text-sm mb-3">Orçamento não encontrado.</p>
        <Link href="/orcamentos" className="text-blueprint text-sm">
          ← Voltar para orçamentos
        </Link>
      </div>
    );
  }

  const chosen = suppliers.find((s) => s.id === quotation.chosen_supplier_id) ?? null;
  const chosenTotals = chosen ? supplierTotals(items, prices, chosen) : null;

  return (
    <div>
      <PageHeader
        eyebrow={`${CATEGORY_LABELS[quotation.category]} · ${QUOTATION_STATUS_LABELS[quotation.status]}`}
        title={quotation.title}
        action={
          <div className="flex flex-wrap gap-2">
            {quotation.status === "aberto" && (
              <button
                onClick={() => setStatus({ status: "cancelado" })}
                className="bg-card border border-line hover:bg-paper text-ink text-sm font-medium px-4 py-2 rounded-md"
              >
                Cancelar orçamento
              </button>
            )}
            {quotation.status !== "aberto" && !quotation.installment_id && (
              <button
                onClick={() => setStatus({ status: "aberto", chosen_supplier_id: null })}
                className="bg-card border border-line hover:bg-paper text-ink text-sm font-medium px-4 py-2 rounded-md"
              >
                Reabrir cotação
              </button>
            )}
            <button
              onClick={deleteQuotation}
              className="flex items-center gap-1.5 bg-card border border-line hover:bg-paper text-ink-soft hover:text-safety text-sm px-3 py-2 rounded-md"
              aria-label="Excluir orçamento"
            >
              <Trash2 size={15} />
            </button>
          </div>
        }
      />

      <div className="px-6 md:px-10 py-8 space-y-6 min-w-0">
        <Link href="/orcamentos" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-blueprint">
          <ArrowLeft size={15} /> Orçamentos
        </Link>

        {quotation.notes && (
          <p className="text-sm text-ink-soft max-w-3xl whitespace-pre-line">{quotation.notes}</p>
        )}

        {error && (
          <div className="bg-safety/10 border border-safety/40 text-safety text-sm rounded-md px-4 py-2.5 max-w-3xl">
            {error}
          </div>
        )}

        {chosen && chosenTotals && (
          <div className="bg-success/10 border border-success/40 rounded-lg p-4 max-w-3xl flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-sm font-medium text-success flex items-center gap-1.5">
                <CheckCircle2 size={16} /> Escolhido: {chosen.name}
              </p>
              <p className="text-xs text-ink-soft font-mono mt-0.5">
                Total {formatCurrency(chosenTotals.total)}
                {!chosenTotals.complete && " · faltam preços de alguns itens"}
              </p>
            </div>
            {quotation.installment_id ? (
              <Link
                href="/pagamentos"
                className="flex items-center gap-1.5 text-sm text-blueprint font-medium"
              >
                <Receipt size={15} /> Conta a pagar gerada — ver em Pagamentos
              </Link>
            ) : (
              <button
                onClick={() => {
                  setPayAccountId("");
                  setPayOpen(true);
                }}
                disabled={chosenTotals.total <= 0}
                className="flex items-center gap-2 bg-blueprint hover:bg-blueprint-dark text-white text-sm font-medium px-4 py-2 rounded-md disabled:opacity-60"
              >
                <Receipt size={15} /> Gerar conta a pagar
              </button>
            )}
          </div>
        )}

        {/* Fornecedores */}
        {!locked && (
          <form onSubmit={addSupplier} className="max-w-3xl">
            <label className="block text-sm text-ink-soft mb-1">
              Fornecedores ({suppliers.length}/{SUGGESTED_SUPPLIERS} sugeridos para comparar)
            </label>
            <div className="flex gap-2">
              <input
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                list="supplier-suggestions"
                placeholder="Nome do fornecedor"
                className="flex-1 min-w-0 rounded-md border border-line bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blueprint"
              />
              <datalist id="supplier-suggestions">
                {supplierSuggestions.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
              <button
                type="submit"
                disabled={!newSupplierName.trim()}
                className="shrink-0 flex items-center gap-1.5 bg-blueprint hover:bg-blueprint-dark text-white text-sm font-medium px-4 rounded-md disabled:opacity-60"
              >
                <Plus size={15} /> Adicionar
              </button>
            </div>
          </form>
        )}

        {/* Comparação */}
        {items.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Comece adicionando os itens que quer orçar (ex.: Cimento CP-II, 40 sacos).
          </p>
        ) : suppliers.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Agora adicione os fornecedores acima para lançar os preços de cada um.
          </p>
        ) : null}

        {items.length > 0 && suppliers.length > 0 && (
          <div className="overflow-x-auto border border-line rounded-lg bg-card">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left font-medium text-xs uppercase tracking-wide text-ink-soft px-3 py-3 min-w-[200px]">
                    Item
                  </th>
                  <th className="text-left font-medium text-xs uppercase tracking-wide text-ink-soft px-2 py-3 w-20">
                    Qtd
                  </th>
                  <th className="text-left font-medium text-xs uppercase tracking-wide text-ink-soft px-2 py-3 w-20">
                    Un.
                  </th>
                  {suppliers.map((s) => (
                    <th key={s.id} className="px-3 py-3 min-w-[170px] text-left align-top">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-display font-semibold text-ink truncate">{s.name}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {cheapestId === s.id && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success bg-success/10 border border-success/40 rounded-full px-1.5 py-0.5">
                                <Trophy size={10} /> Menor preço
                              </span>
                            )}
                            {quotation.chosen_supplier_id === s.id && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blueprint bg-blueprint/10 border border-blueprint/40 rounded-full px-1.5 py-0.5">
                                <CheckCircle2 size={10} /> Escolhido
                              </span>
                            )}
                          </div>
                        </div>
                        {!locked && (
                          <button
                            onClick={() => removeSupplier(s)}
                            className="text-ink-soft hover:text-safety shrink-0"
                            aria-label={`Remover ${s.name}`}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const rowPrices = suppliers
                    .map((s) => prices.find((p) => p.supplier_id === s.id && p.item_id === item.id))
                    .filter((p): p is QuotationPrice => !!p)
                    .map((p) => Number(p.unit_price));
                  const rowMin = rowPrices.length > 1 ? Math.min(...rowPrices) : null;
                  return (
                    <tr key={item.id} className="border-b border-line/60 align-top">
                      <td className="px-3 py-2">
                        <input
                          key={`d-${item.id}-${item.description}`}
                          defaultValue={item.description}
                          disabled={locked}
                          onKeyDown={blurOnEnter}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v && v !== item.description) updateItem(item, { description: v });
                          }}
                          className="w-full rounded-md border border-transparent hover:border-line focus:border-line bg-transparent px-2 py-1.5 text-sm"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          key={`q-${item.id}-${item.quantity}`}
                          defaultValue={moneyToInput(item.quantity)}
                          disabled={locked}
                          inputMode="decimal"
                          onKeyDown={blurOnEnter}
                          onBlur={(e) => {
                            const v = parseMoney(e.target.value);
                            if (v && v > 0 && v !== Number(item.quantity)) updateItem(item, { quantity: v });
                            else e.target.value = moneyToInput(item.quantity);
                          }}
                          className="w-full rounded-md border border-transparent hover:border-line focus:border-line bg-transparent px-2 py-1.5 text-sm font-mono"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          key={`u-${item.id}-${item.unit}`}
                          defaultValue={item.unit ?? ""}
                          disabled={locked}
                          onKeyDown={blurOnEnter}
                          onBlur={(e) => {
                            const v = e.target.value.trim() || null;
                            if (v !== item.unit) updateItem(item, { unit: v });
                          }}
                          className="w-full rounded-md border border-transparent hover:border-line focus:border-line bg-transparent px-2 py-1.5 text-sm"
                        />
                      </td>
                      {suppliers.map((s) => {
                        const price = prices.find((p) => p.supplier_id === s.id && p.item_id === item.id);
                        const isMin = rowMin !== null && price && Number(price.unit_price) === rowMin;
                        return (
                          <td key={s.id} className="px-3 py-2">
                            <input
                              key={`p-${s.id}-${item.id}-${price?.unit_price ?? ""}`}
                              defaultValue={moneyToInput(price ? Number(price.unit_price) : null)}
                              disabled={locked}
                              inputMode="decimal"
                              placeholder="R$ 0,00"
                              onKeyDown={blurOnEnter}
                              onBlur={(e) => savePrice(s, item, e.target.value)}
                              className={`w-full rounded-md border px-2 py-1.5 text-sm font-mono text-right ${
                                isMin ? "border-success/60 bg-success/10" : "border-line bg-white"
                              }`}
                            />
                            {price && (
                              <p className="text-[11px] text-ink-soft font-mono text-right mt-0.5">
                                = {formatCurrency(Number(price.unit_price) * Number(item.quantity))}
                              </p>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-1 py-2">
                        {!locked && (
                          <button
                            onClick={() => removeItem(item)}
                            className="text-ink-soft hover:text-safety mt-1.5"
                            aria-label="Remover item"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-b border-line/60">
                  <td colSpan={3} className="px-3 py-2 text-xs uppercase tracking-wide text-ink-soft">
                    Subtotal
                  </td>
                  {suppliers.map((s) => {
                    const t = supplierTotals(items, prices, s);
                    return (
                      <td key={s.id} className="px-3 py-2 text-right font-mono text-sm">
                        {formatCurrency(t.subtotal)}
                        {!t.complete && (
                          <p className="text-[11px] text-safety font-sans">
                            {t.pricedItems}/{items.length} itens cotados
                          </p>
                        )}
                      </td>
                    );
                  })}
                  <td />
                </tr>
                <tr className="border-b border-line/60">
                  <td colSpan={3} className="px-3 py-2 text-xs uppercase tracking-wide text-ink-soft">
                    Frete
                  </td>
                  {suppliers.map((s) => (
                    <td key={s.id} className="px-3 py-2">
                      <input
                        key={`f-${s.id}-${s.freight}`}
                        defaultValue={Number(s.freight) ? moneyToInput(Number(s.freight)) : ""}
                        disabled={locked}
                        inputMode="decimal"
                        placeholder="R$ 0,00"
                        onKeyDown={blurOnEnter}
                        onBlur={(e) => {
                          const v = parseMoney(e.target.value) ?? 0;
                          if (v !== Number(s.freight)) updateSupplier(s, { freight: v });
                        }}
                        className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm font-mono text-right"
                      />
                    </td>
                  ))}
                  <td />
                </tr>
                <tr className="border-b border-line bg-paper/60">
                  <td colSpan={3} className="px-3 py-3 text-xs uppercase tracking-wide text-ink font-medium">
                    Total
                  </td>
                  {suppliers.map((s) => {
                    const t = supplierTotals(items, prices, s);
                    return (
                      <td
                        key={s.id}
                        className={`px-3 py-3 text-right font-mono font-semibold ${
                          cheapestId === s.id ? "text-success" : "text-ink"
                        }`}
                      >
                        {formatCurrency(t.total)}
                      </td>
                    );
                  })}
                  <td />
                </tr>
                <tr className="border-b border-line/60">
                  <td colSpan={3} className="px-3 py-2 text-xs uppercase tracking-wide text-ink-soft">
                    Prazo de entrega
                  </td>
                  {suppliers.map((s) => (
                    <td key={s.id} className="px-3 py-2">
                      <input
                        key={`dt-${s.id}-${s.delivery_time ?? ""}`}
                        defaultValue={s.delivery_time ?? ""}
                        disabled={locked}
                        placeholder="Ex: 3 dias"
                        onKeyDown={blurOnEnter}
                        onBlur={(e) => {
                          const v = e.target.value.trim() || null;
                          if (v !== s.delivery_time) updateSupplier(s, { delivery_time: v });
                        }}
                        className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm"
                      />
                    </td>
                  ))}
                  <td />
                </tr>
                <tr className="border-b border-line/60">
                  <td colSpan={3} className="px-3 py-2 text-xs uppercase tracking-wide text-ink-soft">
                    Pagamento
                  </td>
                  {suppliers.map((s) => (
                    <td key={s.id} className="px-3 py-2">
                      <input
                        key={`pt-${s.id}-${s.payment_terms ?? ""}`}
                        defaultValue={s.payment_terms ?? ""}
                        disabled={locked}
                        placeholder="Ex: 30 dias, à vista"
                        onKeyDown={blurOnEnter}
                        onBlur={(e) => {
                          const v = e.target.value.trim() || null;
                          if (v !== s.payment_terms) updateSupplier(s, { payment_terms: v });
                        }}
                        className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm"
                      />
                    </td>
                  ))}
                  <td />
                </tr>
                {quotation.status === "aberto" && (
                  <tr>
                    <td colSpan={3} />
                    {suppliers.map((s) => (
                      <td key={s.id} className="px-3 py-3">
                        <button
                          onClick={() => choose(s)}
                          className="w-full bg-blueprint hover:bg-blueprint-dark text-white text-sm font-medium py-2 rounded-md transition-colors"
                        >
                          Escolher
                        </button>
                      </td>
                    ))}
                    <td />
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        )}

        {/* Anexos */}
        <div className="max-w-3xl">
          <h2 className="font-display font-semibold text-ink flex items-center gap-2 mb-2">
            <Paperclip size={16} /> Anexos
            {attachments.length > 0 && (
              <span className="text-xs font-mono text-ink-soft">({attachments.length})</span>
            )}
          </h2>
          <p className="text-xs text-ink-soft mb-3">
            Propostas, PDFs, fotos e planilhas. Escolha de qual fornecedor é o arquivo, ou deixe como
            geral.
          </p>

          <div className="flex flex-wrap gap-2 mb-3">
            <select
              value={attachTarget}
              onChange={(e) => setAttachTarget(e.target.value)}
              className="rounded-md border border-line bg-white px-3 py-2 text-sm"
            >
              <option value="">Geral (do orçamento)</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  Proposta de {s.name}
                </option>
              ))}
            </select>
            <label
              className={`flex items-center gap-2 bg-blueprint hover:bg-blueprint-dark text-white text-sm font-medium px-4 py-2 rounded-md transition-colors cursor-pointer ${
                uploading ? "opacity-60 pointer-events-none" : ""
              }`}
            >
              <Plus size={15} /> {uploading ? "Enviando…" : "Anexar arquivos"}
              <input
                type="file"
                multiple
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  uploadAttachments(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          {uploadErrors.length > 0 && (
            <ul className="mb-3 space-y-1">
              {uploadErrors.map((m) => (
                <li key={m} className="text-xs text-safety">
                  {m}
                </li>
              ))}
            </ul>
          )}

          {attachments.length === 0 ? (
            <p className="text-sm text-ink-soft">Nenhum arquivo anexado ainda.</p>
          ) : (
            <div className="space-y-2">
              {attachments.map((att) => {
                const owner = suppliers.find((s) => s.id === att.supplier_id);
                return (
                  <div
                    key={att.id}
                    className="flex items-center gap-3 bg-card border border-line rounded-md px-3 py-2 min-w-0"
                  >
                    <FileText size={16} className="text-blueprint shrink-0" />
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() => openDocument(att.file_path)}
                        className="text-sm text-ink hover:text-blueprint hover:underline truncate block max-w-full text-left"
                      >
                        {att.name}
                      </button>
                      <p className="text-[11px] text-ink-soft">
                        {owner ? `Proposta de ${owner.name}` : "Geral"}
                      </p>
                    </div>
                    <button
                      onClick={() => removeAttachment(att)}
                      className="text-ink-soft hover:text-safety shrink-0"
                      aria-label={`Remover ${att.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Adicionar item */}
        {!locked && (
          <form onSubmit={addItem} className="max-w-3xl">
            <label className="block text-sm text-ink-soft mb-1">Adicionar item</label>
            <div className="grid grid-cols-[1fr_72px_80px_auto] gap-2">
              <input
                value={newItemDesc}
                onChange={(e) => setNewItemDesc(e.target.value)}
                placeholder="Ex: Cimento CP-II 50kg"
                className="min-w-0 rounded-md border border-line bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blueprint"
              />
              <input
                value={newItemQty}
                onChange={(e) => setNewItemQty(e.target.value)}
                inputMode="decimal"
                placeholder="Qtd"
                className="min-w-0 rounded-md border border-line bg-white px-3 py-2 text-sm font-mono"
              />
              <input
                value={newItemUnit}
                onChange={(e) => setNewItemUnit(e.target.value)}
                placeholder="Un."
                className="min-w-0 rounded-md border border-line bg-white px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={!newItemDesc.trim()}
                className="flex items-center gap-1.5 bg-blueprint hover:bg-blueprint-dark text-white text-sm font-medium px-3 rounded-md disabled:opacity-60"
              >
                <Plus size={15} /> Item
              </button>
            </div>
          </form>
        )}
      </div>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Gerar conta a pagar">
        <form onSubmit={createInstallment} className="space-y-4">
          {chosen && chosenTotals && (
            <div className="rounded-md border border-line bg-paper/60 px-3 py-2.5 text-sm">
              <p className="text-ink font-medium truncate">
                {quotation.title} — {chosen.name}
              </p>
              <p className="font-mono text-ink-soft text-xs mt-0.5">
                {formatCurrency(chosenTotals.total)} · {CATEGORY_LABELS[quotation.category]}
              </p>
            </div>
          )}
          <div>
            <label className="block text-sm text-ink-soft mb-1">Vencimento</label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-ink-soft mb-1">Conta de origem (opcional)</label>
            <select
              value={payAccountId}
              onChange={(e) => setPayAccountId(e.target.value)}
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
            >
              <option value="">Definir depois</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={creatingPayment}
            className="w-full bg-blueprint hover:bg-blueprint-dark text-white font-medium py-2.5 rounded-md transition-colors disabled:opacity-60"
          >
            {creatingPayment ? "Gerando…" : "Gerar conta a pagar"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
