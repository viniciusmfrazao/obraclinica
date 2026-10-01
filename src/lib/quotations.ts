import { QuotationItem, QuotationPrice, QuotationSupplier } from "./types";

export const PAYMENT_METHODS = [
  "À vista",
  "PIX",
  "Boleto",
  "Cartão de crédito",
  "Cartão de débito",
  "Transferência",
  "Dinheiro",
  "Cheque",
  "Outro",
];

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Aceita "1.234,56", "1234,56" e "1234.56"
export function parseMoney(raw: string): number | null {
  const v = raw.trim().replace(/\s/g, "").replace(/^R\$/, "");
  if (!v) return null;
  const normalized = v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Valor bruto da linha: valor unitário × quantidade
export function lineGross(item: QuotationItem, price: QuotationPrice | undefined): number | null {
  if (!price) return null;
  return round2(Number(price.unit_price) * Number(item.quantity));
}

// Desconto da linha em R$ (valor fixo ou % do bruto), nunca maior que o bruto
export function lineDiscountAmount(item: QuotationItem, price: QuotationPrice | undefined): number {
  const gross = lineGross(item, price);
  if (gross === null || !price) return 0;
  const raw =
    price.discount_type === "percentual"
      ? (gross * Number(price.discount_value || 0)) / 100
      : Number(price.discount_value || 0);
  return round2(Math.min(Math.max(raw, 0), gross));
}

// Total calculado da linha (bruto − desconto), sem o ajuste manual
export function lineComputed(item: QuotationItem, price: QuotationPrice | undefined): number | null {
  const gross = lineGross(item, price);
  if (gross === null) return null;
  return round2(gross - lineDiscountAmount(item, price));
}

// Total da linha: valor ajustado à mão, ou o calculado
export function lineTotal(item: QuotationItem, price: QuotationPrice | undefined): number | null {
  if (!price) return null;
  if (price.line_total_override !== null && price.line_total_override !== undefined) {
    return round2(Number(price.line_total_override));
  }
  return lineComputed(item, price);
}

export interface SupplierTotals {
  computedSubtotal: number; // soma das linhas
  subtotal: number; // ajustado à mão ou calculado
  subtotalAdjusted: boolean;
  discountAmount: number; // sempre em R$
  freight: number;
  computedTotal: number; // subtotal − desconto + frete
  total: number; // ajustado à mão ou calculado
  totalAdjusted: boolean;
  pricedItems: number;
  complete: boolean;
}

export function supplierTotals(
  items: QuotationItem[],
  prices: QuotationPrice[],
  supplier: QuotationSupplier
): SupplierTotals {
  let computedSubtotal = 0;
  let pricedItems = 0;
  for (const item of items) {
    const price = prices.find((p) => p.supplier_id === supplier.id && p.item_id === item.id);
    const lt = lineTotal(item, price);
    if (lt !== null) {
      computedSubtotal += lt;
      pricedItems += 1;
    }
  }
  computedSubtotal = round2(computedSubtotal);

  const subtotalAdjusted = supplier.subtotal_override !== null && supplier.subtotal_override !== undefined;
  const subtotal = subtotalAdjusted ? round2(Number(supplier.subtotal_override)) : computedSubtotal;

  const rawDiscount =
    supplier.discount_type === "percentual"
      ? (subtotal * Number(supplier.discount_value || 0)) / 100
      : Number(supplier.discount_value || 0);
  const discountAmount = round2(Math.min(Math.max(rawDiscount, 0), subtotal));

  const freight = round2(Number(supplier.freight || 0));
  const computedTotal = round2(subtotal - discountAmount + freight);

  const totalAdjusted = supplier.total_override !== null && supplier.total_override !== undefined;
  const total = totalAdjusted ? round2(Number(supplier.total_override)) : computedTotal;

  return {
    computedSubtotal,
    subtotal,
    subtotalAdjusted,
    discountAmount,
    freight,
    computedTotal,
    total,
    totalAdjusted,
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

// Divide o total em parcelas em centavos; a diferença de centavos vai para a primeira
export function splitInstallments(total: number, count: number): number[] {
  const n = Math.max(1, Math.floor(count));
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  const rest = cents - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i === 0 ? rest : 0)) / 100);
}

// Soma meses mantendo o dia (ou o último dia do mês, se não existir)
export function addMonthsISO(dateISO: string, months: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}
