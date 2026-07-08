"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Plus, Paperclip, Receipt, Pencil, Target } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Payment, PaymentCategory, CATEGORY_LABELS, Budget } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { useActivities } from "@/lib/use-activities";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";

const ACCOUNT_SUGGESTIONS = ["Conta corrente", "Cartão de crédito", "Pix", "Dinheiro"];

export default function PagamentosPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const activities = useActivities();

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<PaymentCategory>("material");
  const [supplier, setSupplier] = useState("");
  const [account, setAccount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [activityId, setActivityId] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [existingReceipt, setExistingReceipt] = useState<string | null>(null);
  const [existingInvoice, setExistingInvoice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // orçamento
  const [budgetCategory, setBudgetCategory] = useState<PaymentCategory>("material");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);

  // filtros
  const [filterCategory, setFilterCategory] = useState<PaymentCategory | "">("");
  const [filterActivity, setFilterActivity] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    const [p, b] = await Promise.all([
      supabase.from("payments").select("*").order("date", { ascending: false }),
      supabase.from("budgets").select("*"),
    ]);
    setPayments(p.data ?? []);
    setBudgets(b.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function uploadIfPresent(file: File | null) {
    if (!file) return null;
    const path = `${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("documents").upload(path, file);
    return error ? null : path;
  }

  function openNew() {
    setEditingId(null);
    setDescription("");
    setAmount("");
    setCategory("material");
    setSupplier("");
    setAccount("");
    setDate(new Date().toISOString().slice(0, 10));
    setActivityId("");
    setReceiptFile(null);
    setInvoiceFile(null);
    setExistingReceipt(null);
    setExistingInvoice(null);
    setOpen(true);
  }

  function openEdit(p: Payment) {
    setEditingId(p.id);
    setDescription(p.description);
    setAmount(String(p.amount));
    setCategory(p.category);
    setSupplier(p.supplier ?? "");
    setAccount(p.account ?? "");
    setDate(p.date);
    setActivityId(p.activity_id ?? "");
    setReceiptFile(null);
    setInvoiceFile(null);
    setExistingReceipt(p.receipt_path);
    setExistingInvoice(p.invoice_path);
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const receipt_path = receiptFile ? await uploadIfPresent(receiptFile) : existingReceipt;
    const invoice_path = invoiceFile ? await uploadIfPresent(invoiceFile) : existingInvoice;

    const payload = {
      description,
      amount: parseFloat(amount.replace(",", ".")),
      category,
      supplier: supplier || null,
      account: account || null,
      date,
      activity_id: activityId || null,
      receipt_path,
      invoice_path,
    };

    if (editingId) {
      await supabase.from("payments").update(payload).eq("id", editingId);
    } else {
      await supabase.from("payments").insert(payload);
    }

    setSaving(false);
    setOpen(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Remover este pagamento?")) return;
    await supabase.from("payments").delete().eq("id", id);
    load();
  }

  async function openFile(path: string) {
    const { data } = await supabase.storage.from("documents").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function saveBudget(e: React.FormEvent) {
    e.preventDefault();
    setSavingBudget(true);
    const value = parseFloat(budgetAmount.replace(",", "."));
    const existing = budgets.find((b) => b.category === budgetCategory);
    if (existing) {
      await supabase.from("budgets").update({ amount: value }).eq("id", existing.id);
    } else {
      await supabase.from("budgets").insert({ category: budgetCategory, amount: value });
    }
    setSavingBudget(false);
    setBudgetAmount("");
    load();
  }

  const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  const filtered = payments.filter((p) => {
    if (filterCategory && p.category !== filterCategory) return false;
    if (filterActivity && p.activity_id !== filterActivity) return false;
    if (filterFrom && p.date < filterFrom) return false;
    if (filterTo && p.date > filterTo) return false;
    if (
      search &&
      !p.description.toLowerCase().includes(search.toLowerCase()) &&
      !(p.supplier ?? "").toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const spentByCategory = payments.reduce<Record<string, number>>((acc, p) => {
    acc[p.category] = (acc[p.category] ?? 0) + Number(p.amount);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        eyebrow={`Total registrado · ${formatCurrency(total)}`}
        title="Pagamentos"
        action={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setBudgetOpen(true)}
              className="flex items-center gap-2 bg-card border border-line hover:bg-paper text-ink text-sm font-medium px-4 py-2 rounded-md transition-colors"
            >
              <Target size={16} /> Orçamento
            </button>
            <button
              onClick={openNew}
              className="flex items-center gap-2 bg-blueprint hover:bg-blueprint-dark text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
            >
              <Plus size={16} /> Novo pagamento
            </button>
          </div>
        }
      />

      <div className="px-6 md:px-10 py-8">
        {budgets.length > 0 && (
          <div className="bg-card border border-line rounded-lg p-5 mb-6 max-w-4xl">
            <h2 className="font-display font-semibold text-ink mb-4">
              Orçamento por categoria
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {budgets
                .filter((b) => b.category)
                .map((b) => {
                  const spent = spentByCategory[b.category!] ?? 0;
                  const pct = Math.min(100, (spent / Number(b.amount)) * 100);
                  const over = spent > Number(b.amount);
                  return (
                    <div key={b.id}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-ink-soft">
                          {CATEGORY_LABELS[b.category as PaymentCategory]}
                        </span>
                        <span className={`font-mono ${over ? "text-safety" : "text-ink"}`}>
                          {formatCurrency(spent)} / {formatCurrency(Number(b.amount))}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-line/50 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${over ? "bg-safety" : "bg-blueprint"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {over && (
                        <p className="text-[11px] text-safety mt-1">
                          Estourou o orçamento em {formatCurrency(spent - Number(b.amount))}
                        </p>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-5 max-w-5xl">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por descrição ou fornecedor…"
            className="flex-1 min-w-[180px] rounded-md border border-line bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blueprint"
          />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as PaymentCategory | "")}
            className="rounded-md border border-line bg-white px-3 py-1.5 text-sm"
          >
            <option value="">Todas categorias</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={filterActivity}
            onChange={(e) => setFilterActivity(e.target.value)}
            className="rounded-md border border-line bg-white px-3 py-1.5 text-sm"
          >
            <option value="">Todas atividades</option>
            {activities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="rounded-md border border-line bg-white px-3 py-1.5 text-sm"
          />
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="rounded-md border border-line bg-white px-3 py-1.5 text-sm"
          />
        </div>

        {loading ? (
          <p className="text-ink-soft text-sm font-mono">Carregando…</p>
        ) : filtered.length === 0 ? (
          <p className="text-ink-soft text-sm">
            {payments.length === 0
              ? "Nenhum pagamento registrado ainda."
              : "Nenhum pagamento encontrado com esses filtros."}
          </p>
        ) : (
          <div className="overflow-x-auto max-w-5xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-soft text-xs uppercase tracking-wide border-b border-line">
                  <th className="py-2 pr-4 font-medium">Data</th>
                  <th className="py-2 pr-4 font-medium">Descrição</th>
                  <th className="py-2 pr-4 font-medium">Categoria</th>
                  <th className="py-2 pr-4 font-medium">Fornecedor</th>
                  <th className="py-2 pr-4 font-medium">Conta</th>
                  <th className="py-2 pr-4 font-medium text-right">Valor</th>
                  <th className="py-2 pr-4 font-medium">Anexos</th>
                  <th className="py-2 pr-4 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-line/60">
                    <td className="py-2.5 pr-4 font-mono text-xs text-ink-soft">
                      {formatDate(p.date)}
                    </td>
                    <td className="py-2.5 pr-4">{p.description}</td>
                    <td className="py-2.5 pr-4 text-ink-soft">
                      {CATEGORY_LABELS[p.category]}
                    </td>
                    <td className="py-2.5 pr-4 text-ink-soft">{p.supplier || "—"}</td>
                    <td className="py-2.5 pr-4 text-ink-soft">{p.account || "—"}</td>
                    <td className="py-2.5 pr-4 text-right font-mono font-medium">
                      {formatCurrency(Number(p.amount))}
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        {p.receipt_path && (
                          <button
                            onClick={() => openFile(p.receipt_path!)}
                            title="Comprovante"
                            className="text-ink-soft hover:text-blueprint"
                          >
                            <Paperclip size={14} />
                          </button>
                        )}
                        {p.invoice_path && (
                          <button
                            onClick={() => openFile(p.invoice_path!)}
                            title="Nota fiscal"
                            className="text-ink-soft hover:text-blueprint"
                          >
                            <Receipt size={14} />
                          </button>
                        )}
                        {!p.receipt_path && !p.invoice_path && (
                          <span className="text-ink-soft">—</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(p)}
                          className="text-ink-soft hover:text-blueprint"
                          aria-label="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => remove(p.id)}
                          className="text-xs text-ink-soft hover:text-safety"
                        >
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? "Editar pagamento" : "Novo pagamento"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-ink-soft mb-1">Descrição</label>
            <input
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Compra de cimento"
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blueprint"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-ink-soft mb-1">Valor (R$)</label>
              <input
                required
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blueprint"
              />
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
          <div className="grid grid-cols-2 gap-3">
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
              <label className="block text-sm text-ink-soft mb-1">Fornecedor</label>
              <input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-ink-soft mb-1">Conta de origem</label>
            <input
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              list="account-suggestions"
              placeholder="Ex: Conta corrente Itaú, Pix pessoal..."
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blueprint"
            />
            <datalist id="account-suggestions">
              {ACCOUNT_SUGGESTIONS.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-ink-soft mb-1">Comprovante</label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                className="w-full text-xs text-ink-soft"
              />
              {existingReceipt && !receiptFile && (
                <p className="text-[11px] text-ink-soft mt-1">Arquivo já anexado</p>
              )}
            </div>
            <div>
              <label className="block text-sm text-ink-soft mb-1">Nota fiscal</label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)}
                className="w-full text-xs text-ink-soft"
              />
              {existingInvoice && !invoiceFile && (
                <p className="text-[11px] text-ink-soft mt-1">Arquivo já anexado</p>
              )}
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blueprint hover:bg-blueprint-dark text-white font-medium py-2.5 rounded-md transition-colors disabled:opacity-60"
          >
            {saving ? "Salvando…" : editingId ? "Salvar alterações" : "Salvar pagamento"}
          </button>
        </form>
      </Modal>

      <Modal open={budgetOpen} onClose={() => setBudgetOpen(false)} title="Orçamento por categoria">
        <form onSubmit={saveBudget} className="space-y-4 mb-6">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-ink-soft mb-1">Categoria</label>
              <select
                value={budgetCategory}
                onChange={(e) => setBudgetCategory(e.target.value as PaymentCategory)}
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
              <label className="block text-sm text-ink-soft mb-1">Valor orçado (R$)</label>
              <input
                required
                inputMode="decimal"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
                placeholder="0,00"
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blueprint"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={savingBudget}
            className="w-full bg-blueprint hover:bg-blueprint-dark text-white font-medium py-2.5 rounded-md transition-colors disabled:opacity-60"
          >
            {savingBudget ? "Salvando…" : "Definir orçamento"}
          </button>
        </form>

        {budgets.filter((b) => b.category).length > 0 && (
          <div className="border-t border-line pt-4 space-y-2">
            <p className="text-xs uppercase tracking-wide text-ink-soft mb-2">
              Orçamentos definidos
            </p>
            {budgets
              .filter((b) => b.category)
              .map((b) => (
                <div key={b.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink">
                    {CATEGORY_LABELS[b.category as PaymentCategory]}
                  </span>
                  <span className="font-mono text-ink-soft">
                    {formatCurrency(Number(b.amount))}
                  </span>
                </div>
              ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
