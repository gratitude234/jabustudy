alter table public.study_billing_orders
  add column if not exists payment_method text not null default 'manual'
    check (payment_method in ('manual', 'paystack')),
  add column if not exists paystack_reference text;

create unique index if not exists study_billing_orders_paystack_ref_idx
  on public.study_billing_orders (paystack_reference)
  where paystack_reference is not null;
