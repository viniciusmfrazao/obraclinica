"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Plus, Check, Trash2, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ShoppingItem } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { useActivities } from "@/lib/use-activities";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";

export default function ListaDeComprasPage() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const activities = useActivities();

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("un");
  const [estimatedPrice, setEstimatedPrice] = useState("");
  const [activityId, setActivityId] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("shopping_list_items")
      .select("*")
      .order("done", { ascending: true })
      .order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openNew() {
    setEditingId(null);
    setName("");
    setQuantity("1");
    setUnit("un");
    setEstimatedPrice("");
    setActivityId("");
    setOpen(true);
  }

  function openEdit(item: ShoppingItem) {
    setEditingId(item.id);
    setName(item.name);
    setQuantity(String(item.quantity));
    setUnit(item.unit);
    setEstimatedPrice(item.estimated_price ? String(item.estimated_price) : "");
    setActivityId(item.activity_id ?? "");
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name,
      quantity: parseFloat(quantity.replace(",", ".")) || 1,
      unit,
      estimated_price: estimatedPrice
        ? parseFloat(estimatedPrice.replace(",", "."))
        : null,
      activity_id: activityId || null,
    };
    if (editingId) {
      await supabase.from("shopping_list_items").update(payload).eq("id", editingId);
    } else {
      await supabase.from("shopping_list_items").insert(payload);
    }
    setSaving(false);
    setOpen(false);
    setName("");
    setQuantity("1");
    setUnit("un");
    setEstimatedPrice("");
    setActivityId("");
    load();
  }

  async function toggleDone(id: string, done: boolean) {
    await supabase
      .from("shopping_list_items")
      .update({ done: !done })
      .eq("id", id);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Remover este item?")) return;
    await supabase.from("shopping_list_items").delete().eq("id", id);
    load();
  }

  const pending = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);
  const estimatedTotal = pending.reduce(
    (sum, i) => sum + (i.estimated_price ?? 0) * i.quantity,
    0
  );

  return (
    <div>
      <PageHeader
        eyebrow={
          estimatedTotal > 0
            ? `Estimativa pendente · ${formatCurrency(estimatedTotal)}`
            : "Materiais e itens a comprar"
        }
        title="Lista de compras"
        action={
          <button
            onClick={openNew}
            className="flex items-center gap-2 bg-blueprint hover:bg-blueprint-dark text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
          >
            <Plus size={16} /> Novo item
          </button>
        }
      />

      <div className="px-6 md:px-10 py-8">
        {loading ? (
          <p className="text-ink-soft text-sm font-mono">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="text-ink-soft text-sm">
            Sua lista de compras está vazia.
          </p>
        ) : (
          <div className="max-w-2xl space-y-6">
            {pending.length > 0 && (
              <div className="space-y-2">
                {pending.map((item) => (
                  <ShoppingRow
                    key={item.id}
                    item={item}
                    onToggle={toggleDone}
                    onRemove={remove}
                    onEdit={openEdit}
                  />
                ))}
              </div>
            )}

            {done.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-soft mb-2">
                  Comprados
                </p>
                <div className="space-y-2">
                  {done.map((item) => (
                    <ShoppingRow
                      key={item.id}
                      item={item}
                      onToggle={toggleDone}
                      onRemove={remove}
                      onEdit={openEdit}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editingId ? "Editar item" : "Novo item"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-ink-soft mb-1">Item</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Cimento CP-II 50kg"
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blueprint"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-ink-soft mb-1">
                Quantidade
              </label>
              <input
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blueprint"
              />
            </div>
            <div>
              <label className="block text-sm text-ink-soft mb-1">
                Unidade
              </label>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="un, kg, m²..."
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blueprint"
              />
            </div>
            <div>
              <label className="block text-sm text-ink-soft mb-1">
                Preço est. (R$)
              </label>
              <input
                value={estimatedPrice}
                onChange={(e) => setEstimatedPrice(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blueprint"
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
            {saving ? "Salvando…" : editingId ? "Salvar alterações" : "Adicionar à lista"}
          </button>
        </form>
      </Modal>
    </div>
  );
}

function ShoppingRow({
  item,
  onToggle,
  onRemove,
  onEdit,
}: {
  item: ShoppingItem;
  onToggle: (id: string, done: boolean) => void;
  onRemove: (id: string) => void;
  onEdit: (item: ShoppingItem) => void;
}) {
  return (
    <div
      className={`bg-card border border-line rounded-lg p-3 flex items-center gap-3 ${
        item.done ? "opacity-60" : ""
      }`}
    >
      <button
        onClick={() => onToggle(item.id, item.done)}
        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
          item.done
            ? "bg-success border-success text-white"
            : "border-line text-transparent hover:border-blueprint"
        }`}
        aria-label={item.done ? "Marcar como pendente" : "Marcar como comprado"}
      >
        <Check size={12} strokeWidth={3} />
      </button>

      <div className="flex-1 min-w-0">
        <p
          className={`text-sm text-ink truncate ${item.done ? "line-through" : ""}`}
        >
          {item.name}
        </p>
        <p className="text-xs text-ink-soft font-mono">
          {item.quantity} {item.unit}
          {item.estimated_price
            ? ` · ${formatCurrency(item.estimated_price * item.quantity)}`
            : ""}
        </p>
      </div>

      <button
        onClick={() => onEdit(item)}
        className="text-ink-soft hover:text-blueprint shrink-0"
        aria-label="Editar"
      >
        <Pencil size={14} />
      </button>

      <button
        onClick={() => onRemove(item.id)}
        className="text-ink-soft hover:text-safety shrink-0"
        aria-label="Remover"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
