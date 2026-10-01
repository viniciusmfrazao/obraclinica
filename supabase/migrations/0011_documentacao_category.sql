-- Nova categoria "Documentação e taxas" em pagamentos e contas a pagar.
alter table public.payments drop constraint payments_category_check;
alter table public.payments add constraint payments_category_check
  check (category in ('material', 'mao_de_obra', 'projeto', 'equipamento', 'documentacao', 'outros'));

alter table public.installments drop constraint installments_category_check;
alter table public.installments add constraint installments_category_check
  check (category in ('material', 'mao_de_obra', 'projeto', 'equipamento', 'documentacao', 'outros'));
