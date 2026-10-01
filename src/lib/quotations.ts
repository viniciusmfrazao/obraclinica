import { QuotationItem, QuotationPrice, QuotationSupplier } from "./types";

// Aceita "1.234,56", "1234,56" e "1234.56"
export function parseMoney(raw: string): number | null {
  const v = raw.trim().replace(/\s/g, "").replace(/^R\$/, "");
  if (!v) return null;
  const normalized = v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export interface SupplierTotals {
  subtotal: number;
  total: number;
  pricedItems: number;
  complete: boolean;
}

export function supplierTotals(
  items: QuotationItem[],
  prices: QuotationPrice[],
  supplier: QuotationSupplier
): SupplierTotals {
  let subtotal = 0;
  let pricedItems = 0;
  for (const item of items) {
    const price = prices.find((p) => p.supplier_id === supplier.id && p.item_id === item.id);
    if (price) {
      subtotal += Number(price.unit_price) * Number(item.quantity);
      pricedItems += 1;
    }
  }
  return {
    subtotal,
    total: subtotal + Number(supplier.freight || 0),
    pricedItems,
    complete: items.length > 0 && pricedItems === items.length,
  };
}

// Id do fornecedor mais barato entre os que cotaram todos os itens
export function cheapestSupplierId(
  items: QuotationItem[],
  prices: QuotationPrice[],
  suppliers: QuotationSupplier[]
): string | null {
  let best: { id: string; total: number } | null = null;
  for (const s of suppliers) {
    const t = supplierTotals(items, prices, s);
    if (!t.complete) continue;
    if (!best || t.total < best.total) best = { id: s.id, total: t.total };
  }
  return best?.id ?? null;
}
