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
import {
  addMonthsISO,
  cheapestSupplierId,
  lineComputed,
  lineTotal,
  parseMoney,
  PAYMENT_METHODS,
  round2,
  splitInstallments,
  supplierTotals,
} from "@/lib/quotations";
import { formatCurrency, formatDate } from "@/lib/format";
import { openDocument, uploadToDocuments } from "@/lib/storage";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";

const SUGGESTED_SUPPLIERS = 3;

function moneyToInput(v: number | null | undefined) {
  return v === null || v === undefined ? "" : String(v).replace(".", ",");
}

function moneyField(v: number) {
  return v.toFixed(2).replace(".", ",");
}

const ADJUSTED_INPUT = "border-safety/60 bg-safety/5";
const LINE_INPUT =
  "w-full min-w-0 rounded-md border border-line bg-white px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blueprint";

function LineField({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="block text-[11px] text-ink-soft mb-1">{label}</span>
      {children}
    </label>
  );
}

function blankSupplier(name: string): QuotationSupplier {
  return {
    id: "__new_supplier__",
    organization_id: "",
    quotation_id: "",
    name,
    freight: 0,
    payment_terms: null,
    delivery_time: null,
    notes: null,
    position: 0,
    discount_type: "valor",
    discount_value: 0,
    subtotal_override: null,
    total_override: null,
    payment_method: null,
    installments_count: 1,
  };
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

  // linha de lançamento (item + fornecedor + valores)
  const [nItem, setNItem] = useState("");
  const [nBrand, setNBrand] = useState("");
  const [nQty, setNQty] = useState("1");
  const [nUnit, setNUnit] = useState("");
  const [nSupplier, setNSupplier] = useState("");
  const [nUnitPrice, setNUnitPrice] = useState("");
  const [nTotalTyped, setNTotalTyped] = useState<string | null>(null);
  const [nDiscType, setNDiscType] = useState<"valor" | "percentual">("valor");
  const [nDiscValue, setNDiscValue] = useState("");
  const [nFreight, setNFreight] = useState("");
  const [nMethod, setNMethod] = useState("");
  const [nDelivery, setNDelivery] = useState("");
  const [addingLine, setAddingLine] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [newSupplierName, setNewSupplierName] = useState("");

  const [payOpen, setPayOpen] = useState(false);
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payAccountId, setPayAccountId] = useState("");
  const [payCount, setPayCount] = useState("1");
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
  function onSupplierTyped(value: string) {
    const prev = suppliers.find((x) => x.name.trim().toLowerCase() === nSupplier.trim().toLowerCase());
    const match = suppliers.find((x) => x.name.trim().toLowerCase() === value.trim().toLowerCase());
    setNSupplier(value);
    if (match) {
      setNFreight(Number(match.freight) ? moneyToInput(Number(match.freight)) : "");
      setNMethod(match.payment_method ?? "");
      setNDelivery(match.delivery_time ?? "");
    } else if (prev) {
      setNFreight("");
      setNMethod("");
      setNDelivery("");
    }
  }

  async function addLine(e: React.FormEvent) {
    e.preventDefault();
    if (!quotation || !currentOrgId) return;
    const desc = nItem.trim();
    if (!desc) return;
    setAddingLine(true);
    setError(null);
    setNotice(null);

    const qtyParsed = parseMoney(nQty);
    const qtyN = qtyParsed && qtyParsed > 0 ? qtyParsed : 1;
    const unitParsed = parseMoney(nUnitPrice);
    const totalParsed = nTotalTyped !== null ? parseMoney(nTotalTyped) : null;
    const discParsed = parseMoney(nDiscValue) ?? 0;

    // 1) item (reaproveita se já existir com o mesmo nome)
    let item: QuotationItem | undefined = items.find(
      (i) => i.description.trim().toLowerCase() === desc.toLowerCase()
    );
    let reused = false;
    if (item) {
      reused = true;
    } else {
      const { data, error: err } = await supabase
        .from("quotation_items")
        .insert({
          organization_id: currentOrgId,
          quotation_id: quotation.id,
          description: desc,
          quantity: qtyN,
          unit: nUnit.trim() || null,
          position: items.length,
        })
        .select()
        .single();
      if (err || !data) {
        setAddingLine(false);
        return setError("Não foi possível adicionar o item.");
      }
      item = data;
      setItems((prev) => [...prev, data]);
    }
    const theItem = item as QuotationItem;

    // 2) fornecedor (cria se for novo) e dados gerais dele
    let supplier: QuotationSupplier | undefined;
    const supName = nSupplier.trim();
    if (supName) {
      supplier = suppliers.find((x) => x.name.trim().toLowerCase() === supName.toLowerCase());
      if (!supplier) {
        const { data, error: err } = await supabase
          .from("quotation_suppliers")
          .insert({
            organization_id: currentOrgId,
            quotation_id: quotation.id,
            name: supName,
            position: suppliers.length,
          })
          .select()
          .single();
        if (err || !data) {
          setAddingLine(false);
          return setError("Não foi possível adicionar o fornecedor.");
        }
        supplier = data;
        setSuppliers((prev) => [...prev, data]);
      }
      const sup = supplier as QuotationSupplier;
      const patch: Partial<QuotationSupplier> = {};
      const fr = parseMoney(nFreight);
      if (fr !== null && fr !== Number(sup.freight)) patch.freight = fr;
      if (nMethod && nMethod !== sup.payment_method) patch.payment_method = nMethod;
      if (nDelivery.trim() && nDelivery.trim() !== sup.delivery_time) patch.delivery_time = nDelivery.trim();
      if (Object.keys(patch).length > 0) await updateSupplier(sup, patch);
    }

    // 3) preço da linha
    let priced = false;
    if (supplier && (unitParsed !== null || totalParsed !== null)) {
      const itemQty = Number(theItem.quantity) > 0 ? Number(theItem.quantity) : 1;
      const unitFinal =
        unitParsed !== null ? unitParsed : Math.round(((totalParsed as number) / itemQty) * 1e6) / 1e6;
      const gross = round2(unitFinal * itemQty);
      const discAmount = round2(
        Math.min(Math.max(nDiscType === "percentual" ? (gross * discParsed) / 100 : discParsed, 0), gross)
      );
      const computed = round2(gross - discAmount);
      const override = totalParsed !== null && round2(totalParsed) !== computed ? totalParsed : null;

      const { data, error: err } = await supabase
        .from("quotation_prices")
        .upsert(
          {
            organization_id: currentOrgId,
            quotation_id: quotation.id,
            supplier_id: (supplier as QuotationSupplier).id,
            item_id: theItem.id,
            unit_price: unitFinal,
            brand: nBrand.trim() || null,
            discount_type: nDiscType,
            discount_value: discParsed,
            line_total_override: override,
          },
          { onConflict: "supplier_id,item_id" }
        )
        .select()
        .single();
      if (err || !data) {
        setAddingLine(false);
        return setError("O item foi criado, mas não foi possível salvar o valor.");
      }
      priced = true;
      setPrices((prev) => [
        ...prev.filter((p) => !(p.supplier_id === data.supplier_id && p.item_id === data.item_id)),
        data,
      ]);
    }

    const notes: string[] = [];
    if (reused) {
      notes.push(
        `“${theItem.description}” já estava no orçamento — mantida a quantidade ${theItem.quantity}${
          theItem.unit ? " " + theItem.unit : ""
        }.`
      );
    }
    if (supplier && !priced) notes.push("Fornecedor adicionado, mas sem valor ainda.");
    if (priced) notes.push(`Linha lançada para ${(supplier as QuotationSupplier).name}.`);
    setNotice(notes.length > 0 ? notes.join(" ") : "Item adicionado.");

    // limpa a linha, mantendo fornecedor e dados gerais para o próximo item
    setNItem("");
    setNBrand("");
    setNQty("1");
    setNUnit("");
    setNUnitPrice("");
    setNTotalTyped(null);
    setNDiscValue("");
    setAddingLine(false);
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
    if (existing && Number(existing.unit_price) === value && existing.line_total_override == null) return;

    const { data, error: err } = await supabase
      .from("quotation_prices")
      .upsert(
        {
          organization_id: currentOrgId,
          quotation_id: quotation.id,
          supplier_id: s.id,
          item_id: item.id,
          unit_price: value,
          line_total_override: null,
        },
        { onConflict: "supplier_id,item_id" }
      )
      .select()
      .single();
    if (err || !data) return setError("Não foi possível salvar o preço.");
    setError(null);
    setPrices((prev) => [...prev.filter((p) => !(p.supplier_id === s.id && p.item_id === item.id)), data]);
  }

  // Marca e desconto da linha. Mudar o desconto volta o total da linha ao cálculo.
  async function savePriceExtras(
    s: QuotationSupplier,
    item: QuotationItem,
    patch: Partial<Pick<QuotationPrice, "brand" | "discount_type" | "discount_value">>
  ) {
    const existing = prices.find((p) => p.supplier_id === s.id && p.item_id === item.id);
    if (!existing) return;
    const full: Partial<QuotationPrice> = { ...patch };
    if ("discount_type" in patch || "discount_value" in patch) full.line_total_override = null;
    const { error: err } = await supabase.from("quotation_prices").update(full).eq("id", existing.id);
    if (err) return setError("Não foi possível salvar a linha.");
    setError(null);
    setPrices((prev) => prev.map((p) => (p.id === existing.id ? { ...p, ...full } : p)));
  }

  // Total da linha editável: grava o valor digitado e mantém o unitário coerente
  async function saveLineTotal(s: QuotationSupplier, item: QuotationItem, raw: string) {
    if (!quotation || !currentOrgId) return;
    const existing = prices.find((p) => p.supplier_id === s.id && p.item_id === item.id);
    const value = parseMoney(raw);
    const qty = Number(item.quantity);

    if (value === null) {
      // campo limpo: volta ao cálculo automático
      if (existing && existing.line_total_override != null) {
        const { error: err } = await supabase
          .from("quotation_prices")
          .update({ line_total_override: null })
          .eq("id", existing.id);
        if (err) return setError("Não foi possível salvar o total da linha.");
        setPrices((prev) => prev.map((p) => (p.id === existing.id ? { ...p, line_total_override: null } : p)));
      }
      return;
    }

    const computed = lineComputed(item, existing);
    const override = computed !== null && value === computed ? null : value;
    if (existing && Number(existing.line_total_override ?? -1) === (override ?? -1)) return;

    const unitPrice = existing
      ? Number(existing.unit_price)
      : Math.round((qty > 0 ? value / qty : value) * 1e6) / 1e6;

    const { data, error: err } = await supabase
      .from("quotation_prices")
      .upsert(
        {
          organization_id: currentOrgId,
          quotation_id: quotation.id,
          supplier_id: s.id,
          item_id: item.id,
          unit_price: unitPrice,
          line_total_override: override,
        },
        { onConflict: "supplier_id,item_id" }
      )
      .select()
      .single();
    if (err || !data) return setError("Não foi possível salvar o total da linha.");
    setError(null);
    setPrices((prev) => [...prev.filter((p) => !(p.supplier_id === s.id && p.item_id === item.id)), data]);
  }

  // Subtotal / total editáveis: igual ao calculado = volta ao automático
  function saveSubtotal(s: QuotationSupplier, raw: string) {
    const t = supplierTotals(items, prices, s);
    const v = parseMoney(raw);
    const next = v === null || v === t.computedSubtotal ? null : v;
    if ((s.subtotal_override ?? null) === next) return;
    updateSupplier(s, { subtotal_override: next });
  }

  function saveTotal(s: QuotationSupplier, raw: string) {
    const t = supplierTotals(items, prices, s);
    const v = parseMoney(raw);
    const next = v === null || v === t.computedTotal ? null : v;
    if ((s.total_override ?? null) === next) return;
    updateSupplier(s, { total_override: next });
  }

  function saveDiscountAmount(s: QuotationSupplier, raw: string) {
    // digitar o valor em R$ troca o desconto para "R$"
    const v = parseMoney(raw) ?? 0;
    updateSupplier(s, { discount_type: "valor", discount_value: v });
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
    const count = Math.min(36, Math.max(1, parseInt(payCount, 10) || 1));
    const amounts = splitInstallments(totals.total, count);
    const method = chosen.payment_method ? ` · ${chosen.payment_method}` : "";
    setCreatingPayment(true);
    const { data: created, error: err } = await supabase
      .from("installments")
      .insert(
        amounts.map((amount, idx) => ({
          description: `${quotation.title} — ${chosen.name}${count > 1 ? ` (${idx + 1}/${count})` : ""}${method}`,
          amount,
          category: quotation.category,
          supplier: chosen.name,
          account_id: payAccountId || null,
          due_date: addMonthsISO(dueDate, idx),
          activity_id: quotation.activity_id,
          organization_id: currentOrgId,
        }))
      )
      .select();
    if (err || !created || created.length === 0) {
      setCreatingPayment(false);
      return setError("Não foi possível gerar as contas a pagar.");
    }
    const data = [...created].sort((x, y) => x.due_date.localeCompare(y.due_date))[0];
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

  // ---- prévia da linha que está sendo digitada
  const nQtyParsed = parseMoney(nQty);
  const nQtyN = nQtyParsed && nQtyParsed > 0 ? nQtyParsed : 1;
  const nUnitN = parseMoney(nUnitPrice);
  const nDiscN = parseMoney(nDiscValue) ?? 0;
  const nGross = nUnitN !== null ? round2(nUnitN * nQtyN) : null;
  const nDiscAmount =
    nGross !== null
      ? round2(Math.min(Math.max(nDiscType === "percentual" ? (nGross * nDiscN) / 100 : nDiscN, 0), nGross))
      : 0;
  const nComputed = nGross !== null ? round2(nGross - nDiscAmount) : null;
  const nTotalTypedN = nTotalTyped !== null ? parseMoney(nTotalTyped) : null;
  const nLineTotal = nTotalTypedN ?? nComputed;
  const nTotalShown = nTotalTyped ?? (nComputed !== null ? moneyField(nComputed) : "");
  const nSupplierName = nSupplier.trim();
  const nExistingSupplier = nSupplierName
    ? suppliers.find((x) => x.name.trim().toLowerCase() === nSupplierName.toLowerCase())
    : undefined;
  const nExistingItem = nItem.trim()
    ? items.find((i) => i.description.trim().toLowerCase() === nItem.trim().toLowerCase())
    : undefined;

  const linePreview = (() => {
    if (!nSupplierName || nLineTotal === null) return null;
    const base = nExistingSupplier ?? blankSupplier(nSupplierName);
    const freightTyped = parseMoney(nFreight);
    const sup: QuotationSupplier = {
      ...base,
      freight: freightTyped ?? Number(base.freight),
      subtotal_override: null,
      total_override: null,
    };
    const tmpItem: QuotationItem = nExistingItem ?? {
      id: "__new_item__",
      organization_id: "",
      quotation_id: "",
      description: nItem,
      quantity: nQtyN,
      unit: null,
      position: 0,
    };
    const itemsP = nExistingItem ? items : [...items, tmpItem];
    const tmpPrice: QuotationPrice = {
      id: "__new_price__",
      organization_id: "",
      quotation_id: "",
      supplier_id: sup.id,
      item_id: tmpItem.id,
      unit_price: nUnitN ?? nLineTotal / (Number(tmpItem.quantity) || 1),
      line_total_override: nLineTotal,
      brand: null,
      discount_type: "valor",
      discount_value: 0,
    };
    const pricesP = [
      ...prices.filter((p) => !(p.supplier_id === sup.id && p.item_id === tmpItem.id)),
      tmpPrice,
    ];
    const t = supplierTotals(itemsP, pricesP, sup);
    return { line: nLineTotal, freight: t.freight, total: t.total };
  })();

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

        <div className="max-w-3xl">
          <label className="block text-sm text-ink-soft mb-1">Observações do orçamento</label>
          <textarea
            key={`qn-${quotation.notes ?? ""}`}
            defaultValue={quotation.notes ?? ""}
            rows={2}
            onBlur={(e) => {
              const v = e.target.value.trim() || null;
              if (v !== (quotation.notes ?? null)) setStatus({ notes: v });
            }}
            placeholder="Ex: entrega na obra, retirar com nota fiscal, validade da proposta…"
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blueprint"
          />
        </div>

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
                  setPayCount(String(chosen.installments_count || 1));
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

        {/* Adicionar item (linha completa) */}
        {!locked && (
          <form onSubmit={addLine} className="bg-card border border-line rounded-lg p-4 max-w-4xl">
            <h2 className="font-display font-semibold text-ink mb-3">Adicionar item</h2>

            <div className="grid grid-cols-2 md:grid-cols-12 gap-2">
              <LineField label="Item" className="col-span-2 md:col-span-5">
                <input
                  required
                  value={nItem}
                  onChange={(e) => setNItem(e.target.value)}
                  placeholder="Ex: Cimento CP-II 50kg"
                  className={LINE_INPUT}
                />
              </LineField>
              <LineField label="Marca" className="col-span-2 md:col-span-3">
                <input
                  value={nBrand}
                  onChange={(e) => setNBrand(e.target.value)}
                  placeholder="Ex: Cauê"
                  className={LINE_INPUT}
                />
              </LineField>
              <LineField label="Quantidade" className="md:col-span-2">
                <input
                  value={nQty}
                  onChange={(e) => setNQty(e.target.value)}
                  inputMode="decimal"
                  placeholder="10"
                  className={`${LINE_INPUT} font-mono`}
                />
              </LineField>
              <LineField label="Unidade" className="md:col-span-2">
                <input
                  value={nUnit}
                  onChange={(e) => setNUnit(e.target.value)}
                  list="unit-suggestions"
                  placeholder="sc, m², un"
                  className={LINE_INPUT}
                />
                <datalist id="unit-suggestions">
                  {["un", "sc", "m", "m²", "m³", "kg", "l", "cx", "pç", "rolo", "lata", "saco", "barra", "milheiro", "diária", "hora", "verba"].map(
                    (u) => (
                      <option key={u} value={u} />
                    )
                  )}
                </datalist>
              </LineField>

              <LineField label="Fornecedor" className="col-span-2 md:col-span-4">
                <input
                  value={nSupplier}
                  onChange={(e) => onSupplierTyped(e.target.value)}
                  list="line-suppliers"
                  placeholder="Nome do fornecedor"
                  className={LINE_INPUT}
                />
                <datalist id="line-suppliers">
                  {[...new Set([...suppliers.map((x) => x.name), ...supplierSuggestions])].map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
                {nSupplierName && !nExistingSupplier && (
                  <span className="block text-[11px] text-blueprint mt-1">Novo fornecedor neste orçamento</span>
                )}
              </LineField>
              <LineField label="Valor unitário (R$)" className="md:col-span-2">
                <input
                  value={nUnitPrice}
                  onChange={(e) => {
                    setNUnitPrice(e.target.value);
                    setNTotalTyped(null);
                  }}
                  inputMode="decimal"
                  placeholder="50,00"
                  className={`${LINE_INPUT} font-mono text-right`}
                />
              </LineField>
              <LineField label="Desconto" className="col-span-2 md:col-span-3">
                <div className="flex gap-1">
                  <select
                    value={nDiscType}
                    onChange={(e) => {
                      setNDiscType(e.target.value as "valor" | "percentual");
                      setNTotalTyped(null);
                    }}
                    className="w-16 shrink-0 rounded-md border border-line bg-white px-1 py-2 text-sm"
                  >
                    <option value="valor">R$</option>
                    <option value="percentual">%</option>
                  </select>
                  <input
                    value={nDiscValue}
                    onChange={(e) => {
                      setNDiscValue(e.target.value);
                      setNTotalTyped(null);
                    }}
                    inputMode="decimal"
                    placeholder={nDiscType === "percentual" ? "0 %" : "0,00"}
                    className={`${LINE_INPUT} font-mono text-right`}
                  />
                </div>
              </LineField>
              <LineField label="Valor total (R$)" className="col-span-2 md:col-span-3">
                <input
                  value={nTotalShown}
                  onChange={(e) => setNTotalTyped(e.target.value.trim() === "" ? null : e.target.value)}
                  inputMode="decimal"
                  placeholder="calculado"
                  title="Valor unitário × quantidade − desconto. Você pode editar."
                  className={`${LINE_INPUT} font-mono text-right ${
                    nTotalTyped !== null && nComputed !== null && parseMoney(nTotalTyped) !== nComputed
                      ? ADJUSTED_INPUT
                      : ""
                  }`}
                />
              </LineField>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-12 gap-2 mt-2 pt-3 border-t border-line/60">
              <LineField label="Frete (R$)" className="md:col-span-3">
                <input
                  value={nFreight}
                  onChange={(e) => setNFreight(e.target.value)}
                  inputMode="decimal"
                  placeholder="100,00"
                  disabled={!nSupplierName}
                  className={`${LINE_INPUT} font-mono text-right disabled:opacity-50`}
                />
              </LineField>
              <LineField label="Meio de pagamento" className="md:col-span-5">
                <select
                  value={nMethod}
                  onChange={(e) => setNMethod(e.target.value)}
                  disabled={!nSupplierName}
                  className={`${LINE_INPUT} disabled:opacity-50`}
                >
                  <option value="">Selecione…</option>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </LineField>
              <LineField label="Tempo de entrega" className="col-span-2 md:col-span-4">
                <input
                  value={nDelivery}
                  onChange={(e) => setNDelivery(e.target.value)}
                  placeholder="Ex: 3 dias úteis"
                  disabled={!nSupplierName}
                  className={`${LINE_INPUT} disabled:opacity-50`}
                />
              </LineField>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap mt-4">
              <p className="text-xs font-mono text-ink-soft min-w-0">
                {linePreview ? (
                  <>
                    Linha {formatCurrency(linePreview.line)} · Frete {formatCurrency(linePreview.freight)} ·{" "}
                    <span className="text-ink font-semibold">
                      Total geral de {nSupplierName} {formatCurrency(linePreview.total)}
                    </span>
                  </>
                ) : nSupplierName ? (
                  "Informe o valor unitário ou o total para ver o total geral."
                ) : (
                  "Sem fornecedor: o item entra na lista para ser cotado depois."
                )}
              </p>
              <button
                type="submit"
                disabled={addingLine || !nItem.trim()}
                className="flex items-center gap-1.5 bg-blueprint hover:bg-blueprint-dark text-white text-sm font-medium px-4 py-2 rounded-md disabled:opacity-60"
              >
                <Plus size={15} /> {addingLine ? "Adicionando…" : "Adicionar"}
              </button>
            </div>
            {nExistingItem && (
              <p className="text-[11px] text-ink-soft mt-2">
                Este item já está no orçamento: o valor entra na linha dele
                (quantidade mantida: {nExistingItem.quantity}
                {nExistingItem.unit ? ` ${nExistingItem.unit}` : ""}).
              </p>
            )}
          </form>
        )}

        {notice && (
          <div className="bg-success/10 border border-success/40 text-success text-sm rounded-md px-4 py-2.5 max-w-4xl">
            {notice}
          </div>
        )}

        {/* Comparação */}
        {items.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Comece lançando o primeiro item acima (ex.: Cimento Cauê, 10 sc, R$ 50,00, fornecedor, frete e entrega).
          </p>
        ) : suppliers.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Informe um fornecedor na linha acima para lançar o preço de cada item.
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
                              key={`b-${s.id}-${item.id}-${price?.brand ?? ""}`}
                              defaultValue={price?.brand ?? ""}
                              disabled={locked || !price}
                              placeholder="Marca"
                              title={!price ? "Lance o valor unitário primeiro" : undefined}
                              onKeyDown={blurOnEnter}
                              onBlur={(e) => {
                                const v = e.target.value.trim() || null;
                                if (v !== (price?.brand ?? null)) savePriceExtras(s, item, { brand: v });
                              }}
                              className="w-full rounded-md border border-line bg-white px-2 py-1 text-xs mb-1 disabled:opacity-60"
                            />
                            <input
                              key={`p-${s.id}-${item.id}-${price?.unit_price ?? ""}`}
                              defaultValue={moneyToInput(price ? Number(price.unit_price) : null)}
                              disabled={locked}
                              inputMode="decimal"
                              placeholder="Valor unit. R$"
                              onKeyDown={blurOnEnter}
                              onBlur={(e) => savePrice(s, item, e.target.value)}
                              className={`w-full rounded-md border px-2 py-1.5 text-sm font-mono text-right ${
                                isMin ? "border-success/60 bg-success/10" : "border-line bg-white"
                              }`}
                            />
                            <div className="flex gap-1 mt-1">
                              <select
                                value={price?.discount_type ?? "valor"}
                                disabled={locked || !price}
                                onChange={(e) =>
                                  savePriceExtras(s, item, {
                                    discount_type: e.target.value as "valor" | "percentual",
                                  })
                                }
                                className="w-14 shrink-0 rounded border border-line bg-white px-0.5 py-0.5 text-xs disabled:opacity-60"
                              >
                                <option value="valor">R$</option>
                                <option value="percentual">%</option>
                              </select>
                              <input
                                key={`dc-${s.id}-${item.id}-${price?.discount_type ?? ""}-${price?.discount_value ?? ""}`}
                                defaultValue={
                                  price && Number(price.discount_value) ? moneyToInput(Number(price.discount_value)) : ""
                                }
                                disabled={locked || !price}
                                inputMode="decimal"
                                placeholder="desconto"
                                onKeyDown={blurOnEnter}
                                onBlur={(e) => {
                                  const v = parseMoney(e.target.value) ?? 0;
                                  if (price && v !== Number(price.discount_value)) {
                                    savePriceExtras(s, item, { discount_value: v });
                                  }
                                }}
                                className="w-full min-w-0 rounded border border-line bg-white px-1.5 py-0.5 text-xs font-mono text-right disabled:opacity-60"
                              />
                            </div>
                            <div className="flex items-center justify-end gap-1 mt-1">
                              <span className="text-[11px] text-ink-soft">total</span>
                              <input
                                key={`lt-${s.id}-${item.id}-${price?.unit_price ?? ""}-${price?.line_total_override ?? ""}-${price?.discount_type ?? ""}-${price?.discount_value ?? ""}-${item.quantity}`}
                                defaultValue={price ? moneyField(lineTotal(item, price) ?? 0) : ""}
                                disabled={locked}
                                inputMode="decimal"
                                placeholder="R$ 0,00"
                                title={
                                  price?.line_total_override != null
                                    ? "Total ajustado à mão. Apague o campo para voltar ao cálculo automático."
                                    : "Calculado: valor unitário × quantidade − desconto. Você pode editar."
                                }
                                onKeyDown={blurOnEnter}
                                onBlur={(e) => saveLineTotal(s, item, e.target.value)}
                                className={`w-28 rounded border px-1.5 py-0.5 text-xs font-mono text-right ${
                                  price?.line_total_override != null ? ADJUSTED_INPUT : "border-line bg-white/70"
                                }`}
                              />
                            </div>
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
                      <td key={s.id} className="px-3 py-2">
                        <input
                          key={`st-${s.id}-${t.subtotal}-${s.subtotal_override ?? ""}`}
                          defaultValue={moneyField(t.subtotal)}
                          disabled={locked}
                          inputMode="decimal"
                          onKeyDown={blurOnEnter}
                          onBlur={(e) => saveSubtotal(s, e.target.value)}
                          title="Soma das linhas. Você pode editar; apague o campo para voltar ao cálculo."
                          className={`w-full rounded-md border px-2 py-1.5 text-sm font-mono text-right ${
                            t.subtotalAdjusted ? ADJUSTED_INPUT : "border-line bg-white"
                          }`}
                        />
                        {t.subtotalAdjusted && !locked && (
                          <button
                            type="button"
                            onClick={() => updateSupplier(s, { subtotal_override: null })}
                            className="block ml-auto text-[11px] text-safety hover:underline mt-0.5"
                          >
                            ajustado · voltar para {formatCurrency(t.computedSubtotal)}
                          </button>
                        )}
                        {!t.complete && (
                          <p className="text-[11px] text-safety text-right mt-0.5">
                            {t.pricedItems}/{items.length} itens cotados
                          </p>
                        )}
                      </td>
                    );
                  })}
                  <td />
                </tr>
                <tr className="border-b border-line/60">
                  <td colSpan={3} className="px-3 py-2 text-xs uppercase tracking-wide text-ink-soft align-top">
                    Desconto
                  </td>
                  {suppliers.map((s) => {
                    const t = supplierTotals(items, prices, s);
                    return (
                      <td key={s.id} className="px-3 py-2 align-top">
                        <div className="flex gap-1">
                          <select
                            value={s.discount_type}
                            disabled={locked}
                            onChange={(e) =>
                              updateSupplier(s, { discount_type: e.target.value as "valor" | "percentual" })
                            }
                            className="w-16 shrink-0 rounded-md border border-line bg-white px-1 py-1.5 text-sm"
                          >
                            <option value="valor">R$</option>
                            <option value="percentual">%</option>
                          </select>
                          <input
                            key={`dv-${s.id}-${s.discount_type}-${s.discount_value}`}
                            defaultValue={Number(s.discount_value) ? moneyToInput(Number(s.discount_value)) : ""}
                            disabled={locked}
                            inputMode="decimal"
                            placeholder={s.discount_type === "percentual" ? "0 %" : "R$ 0,00"}
                            onKeyDown={blurOnEnter}
                            onBlur={(e) => {
                              const v = parseMoney(e.target.value) ?? 0;
                              if (v !== Number(s.discount_value)) updateSupplier(s, { discount_value: v });
                            }}
                            className="w-full min-w-0 rounded-md border border-line bg-white px-2 py-1.5 text-sm font-mono text-right"
                          />
                        </div>
                        {s.discount_type === "percentual" && (
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className="text-[11px] text-ink-soft">− R$</span>
                            <input
                              key={`da-${s.id}-${t.discountAmount}`}
                              defaultValue={t.discountAmount ? moneyField(t.discountAmount) : ""}
                              disabled={locked}
                              inputMode="decimal"
                              placeholder="0,00"
                              title="Valor do desconto em R$. Editar aqui troca o desconto para valor fixo."
                              onKeyDown={blurOnEnter}
                              onBlur={(e) => {
                                const v = parseMoney(e.target.value) ?? 0;
                                if (v !== t.discountAmount) saveDiscountAmount(s, e.target.value);
                              }}
                              className="w-24 rounded border border-line bg-white/70 px-1.5 py-0.5 text-xs font-mono text-right"
                            />
                          </div>
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
                      <td key={s.id} className="px-3 py-3">
                        <input
                          key={`tt-${s.id}-${t.total}-${s.total_override ?? ""}`}
                          defaultValue={moneyField(t.total)}
                          disabled={locked}
                          inputMode="decimal"
                          onKeyDown={blurOnEnter}
                          onBlur={(e) => saveTotal(s, e.target.value)}
                          title="Subtotal − desconto + frete. Você pode editar; apague o campo para voltar ao cálculo."
                          className={`w-full rounded-md border px-2 py-1.5 text-sm font-mono font-semibold text-right ${
                            t.totalAdjusted
                              ? ADJUSTED_INPUT
                              : cheapestId === s.id
                                ? "border-success/60 bg-success/10 text-success"
                                : "border-line bg-white text-ink"
                          }`}
                        />
                        {t.totalAdjusted && !locked && (
                          <button
                            type="button"
                            onClick={() => updateSupplier(s, { total_override: null })}
                            className="block ml-auto text-[11px] text-safety hover:underline mt-0.5"
                          >
                            ajustado · voltar para {formatCurrency(t.computedTotal)}
                          </button>
                        )}
                      </td>
                    );
                  })}
                  <td />
                </tr>
                <tr className="border-b border-line/60">
                  <td colSpan={3} className="px-3 py-2 text-xs uppercase tracking-wide text-ink-soft">
                    Forma de pagamento
                  </td>
                  {suppliers.map((s) => (
                    <td key={s.id} className="px-3 py-2">
                      <select
                        value={s.payment_method ?? ""}
                        disabled={locked}
                        onChange={(e) => updateSupplier(s, { payment_method: e.target.value || null })}
                        className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm"
                      >
                        <option value="">Selecione…</option>
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </td>
                  ))}
                  <td />
                </tr>
                <tr className="border-b border-line/60">
                  <td colSpan={3} className="px-3 py-2 text-xs uppercase tracking-wide text-ink-soft">
                    Parcelas
                  </td>
                  {suppliers.map((s) => {
                    const t = supplierTotals(items, prices, s);
                    const n = Number(s.installments_count) || 1;
                    return (
                      <td key={s.id} className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <input
                            key={`ic-${s.id}-${s.installments_count}`}
                            type="number"
                            min={1}
                            max={36}
                            defaultValue={s.installments_count}
                            disabled={locked}
                            onKeyDown={blurOnEnter}
                            onBlur={(e) => {
                              const v = Math.min(36, Math.max(1, parseInt(e.target.value, 10) || 1));
                              if (v !== Number(s.installments_count)) updateSupplier(s, { installments_count: v });
                              else e.target.value = String(v);
                            }}
                            className="w-16 rounded-md border border-line bg-white px-2 py-1.5 text-sm font-mono text-right"
                          />
                          <span className="text-xs text-ink-soft font-mono">
                            {n > 1 ? `× ${formatCurrency(splitInstallments(t.total, n)[1] ?? t.total)}` : "à vista"}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                  <td />
                </tr>
                <tr className="border-b border-line/60">
                  <td colSpan={3} className="px-3 py-2 text-xs uppercase tracking-wide text-ink-soft">
                    Condições
                  </td>
                  {suppliers.map((s) => (
                    <td key={s.id} className="px-3 py-2">
                      <input
                        key={`pt-${s.id}-${s.payment_terms ?? ""}`}
                        defaultValue={s.payment_terms ?? ""}
                        disabled={locked}
                        placeholder="Ex: 30/60/90 dias, entrada + 2x"
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
                  <td colSpan={3} className="px-3 py-2 text-xs uppercase tracking-wide text-ink-soft align-top">
                    Observações
                  </td>
                  {suppliers.map((s) => (
                    <td key={s.id} className="px-3 py-2">
                      <textarea
                        key={`sn-${s.id}-${s.notes ?? ""}`}
                        defaultValue={s.notes ?? ""}
                        disabled={locked}
                        rows={2}
                        placeholder="Ex: preço válido até sexta, retirada no depósito"
                        onBlur={(e) => {
                          const v = e.target.value.trim() || null;
                          if (v !== (s.notes ?? null)) updateSupplier(s, { notes: v });
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
      </div>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Gerar contas a pagar">
        <form onSubmit={createInstallment} className="space-y-4">
          {chosen && chosenTotals && (
            <div className="rounded-md border border-line bg-paper/60 px-3 py-2.5 text-sm">
              <p className="text-ink font-medium truncate">
                {quotation.title} — {chosen.name}
              </p>
              <p className="font-mono text-ink-soft text-xs mt-0.5">
                {formatCurrency(chosenTotals.total)} · {CATEGORY_LABELS[quotation.category]}
                {chosen.payment_method ? ` · ${chosen.payment_method}` : ""}
              </p>
              {chosen.payment_terms && (
                <p className="text-xs text-ink-soft mt-0.5">Condições: {chosen.payment_terms}</p>
              )}
            </div>
          )}
          <div>
            <label className="block text-sm text-ink-soft mb-1">Número de parcelas</label>
            <input
              type="number"
              min={1}
              max={36}
              value={payCount}
              onChange={(e) => setPayCount(e.target.value)}
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-sm text-ink-soft mb-1">
              {Number(payCount) > 1 ? "Vencimento da 1ª parcela" : "Vencimento"}
            </label>
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
          {chosenTotals && Number(payCount) > 1 && dueDate && (
            <div className="rounded-md border border-line bg-paper/60 px-3 py-2 text-xs font-mono space-y-0.5">
              {splitInstallments(chosenTotals.total, Math.min(36, Math.max(1, parseInt(payCount, 10) || 1))).map(
                (amount, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="text-ink-soft">
                      {idx + 1}ª · {formatDate(addMonthsISO(dueDate, idx))}
                    </span>
                    <span className="text-ink">{formatCurrency(amount)}</span>
                  </div>
                )
              )}
            </div>
          )}
          <button
            type="submit"
            disabled={creatingPayment}
            className="w-full bg-blueprint hover:bg-blueprint-dark text-white font-medium py-2.5 rounded-md transition-colors disabled:opacity-60"
          >
            {creatingPayment ? "Gerando…" : Number(payCount) > 1 ? "Gerar contas a pagar" : "Gerar conta a pagar"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
