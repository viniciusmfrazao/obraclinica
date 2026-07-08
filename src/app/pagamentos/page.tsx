"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Plus, Paperclip, Receipt, Download } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Payment, PaymentCategory, CATEGORY_LABELS } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { useActivities } from "@/lib/use-activities";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";

const ACCOUNT_SUGGESTIONS = [
  "Conta corrente",
  "Cartão de crédito",
  "Pix",
  "Dinheiro",
];

export default function PagamentosPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
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
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("payments")
      .select("*")
      .order("date", { ascending: false });
    setPayments(data ?? []);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const receipt_path = await uploadIfPresent(receiptFile);
    const invoice_path = await uploadIfPresent(invoiceFile);

    await supabase.from("payments").insert({
      description,
      amount: parseFloat(amount.replace(",", ".")),
      category,
      supplier: supplier || null,
      account: account || null,
      date,
      activity_id: activityId || null,
      receipt_path,
      invoice_path,
    });

    setSaving(false);
    setOpen(false);
    setDescription("");
    setAmount("");
    setSupplier("");
    setAccount("");
    setReceiptFile(null);
    setInvoiceFile(null);
    setActivityId("");
    load();
  }

  async function remove(id: string) {
    if (!confirm("Remover este pagamento?")) return;
    await supabase.from("payments").delete().eq("id", id);
    load();
  }

  async function openFile(path: string) {
    const { data } = await supabase.storage
      .from("documents")
      .createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div>
      <PageHeader
        eyebrow={`Total registrado · ${formatCurrency(total)}`}
        title="Pagamentos"
        action={
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 bg-blueprint hover:bg-blueprint-dark text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
          >
            <Plus size={16} /> Novo pagamento
          </button>
        }
      />

      <div className="px-6 md:px-10 py-8">
        {loading ? (
          <p className="text-ink-soft text-sm font-mono">Carregando…</p>
        ) : payments.length === 0 ? (
          <p className="text-ink-soft text-sm">
            Nenhum pagamento registrado ainda.
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
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-line/60">
                    <td className="py-2.5 pr-4 font-mono text-xs text-ink-soft">
                      {formatDate(p.date)}
                    </td>
                    <td className="py-2.5 pr-4">{p.description}</td>
                    <td className="py-2.5 pr-4 text-ink-soft">
                      {CATEGORY_LABELS[p.category]}
                    </td>
                    <td className="py-2.5 pr-4 text-ink-soft">
                      {p.supplier || "—"}
                    </td>
                    <td className="py-2.5 pr-4 text-ink-soft">
                      {p.account || "—"}
                    </td>
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
                      <button
                        onClick={() => remove(p.id)}
                        className="text-xs text-ink-soft hover:text-safety"
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Novo pagamento">
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
              <label className="block text-sm text-ink-soft mb-1">
                Valor (R$)
              </label>
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
              <label className="block text-sm text-ink-soft mb-1">
                Categoria
              </label>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as PaymentCategory)
                }
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
                Fornecedor
              </label>
              <input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-ink-soft mb-1">
              Conta de origem
            </label>
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
              <label className="block text-sm text-ink-soft mb-1">
                Comprovante
              </label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                className="w-full text-xs text-ink-soft"
              />
            </div>
            <div>
              <label className="block text-sm text-ink-soft mb-1">
                Nota fiscal
              </label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)}
                className="w-full text-xs text-ink-soft"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blueprint hover:bg-blueprint-dark text-white font-medium py-2.5 rounded-md transition-colors disabled:opacity-60"
          >
            {saving ? "Salvando…" : "Salvar pagamento"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
