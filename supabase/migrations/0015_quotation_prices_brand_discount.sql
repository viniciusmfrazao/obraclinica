-- Marca e desconto por linha (item x fornecedor) nos orçamentos.
alter table public.quotation_prices
  add column brand text,
  add column discount_type text not null default 'valor' check (discount_type in ('valor', 'percentual')),
  add column discount_value numeric not null default 0 check (discount_value >= 0);
