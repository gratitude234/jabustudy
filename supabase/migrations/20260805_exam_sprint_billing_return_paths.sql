-- Keep the database return-path guard aligned with the application sanitiser.
-- Exam Sprint checkout returns to /exam or an exact course under /exam/*.

begin;

alter table public.study_billing_orders
  drop constraint if exists study_billing_orders_return_path_check;

alter table public.study_billing_orders
  add constraint study_billing_orders_return_path_check
  check (
    return_path is null
    or (
      length(return_path) <= 500
      and return_path ~ '^/(study|exam)(/|[?#]|$)'
      and return_path !~ '^/study/billing(/|[?#]|$)'
      and return_path not like '//%'
      and position(E'\\' in return_path) = 0
      and return_path !~ E'[\\r\\n]'
    )
  ) not valid;

alter table public.study_billing_orders
  validate constraint study_billing_orders_return_path_check;

commit;
