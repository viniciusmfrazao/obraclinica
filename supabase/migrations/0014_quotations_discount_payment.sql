-- Orçamentos: desconto, valores ajustados à mão, forma de pagamento e parcelas.
alter table public.quotation_prices
  add column line_total_override numeric check (line_total_override is null or line_total_override >= 0);

alter table public.quotation_suppliers
  add column discount_type text not null default 'valor' check (discount_type in ('valor', 'percentual')),
  add column discount_value numeric not null default 0 check (discount_value >= 0),
  add column subtotal_override numeric check (subtotal_override is null or subtotal_override >= 0),
  add column total_override numeric check (total_override is null or total_override >= 0),
  add column payment_method text,
  add column installments_count integer not null default 1 check (installments_count between 1 and 36);
