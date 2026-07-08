alter table payments
  add column if not exists account text,
  add column if not exists invoice_path text;
