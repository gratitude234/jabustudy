-- Read-only Paystack hardening preflight.
-- Run in the Supabase SQL editor before 20260801_paystack_workflow_hardening.sql.

-- 1. More than one active Paystack checkout for a student.
select user_id, count(*) as active_orders, array_agg(reference order by created_at desc) as references
from public.study_billing_orders
where payment_method = 'paystack'
  and status = 'pending_payment'
group by user_id
having count(*) > 1;

-- 2. Approved paid orders with no matching positive credit grant.
select
  orders.id,
  orders.reference,
  orders.user_id,
  orders.plan_key,
  orders.credits,
  orders.paystack_reference,
  orders.reviewed_at
from public.study_billing_orders as orders
where orders.status = 'approved'
  and orders.credits > 0
  and not exists (
    select 1
    from public.study_credit_ledger as ledger
    where ledger.order_id = orders.id
      and ledger.delta = orders.credits
      and ledger.reason in ('purchase', 'plus_grant')
  )
order by orders.created_at desc;

-- 3. Orders that may have been partially fulfilled then reset to pending.
select
  orders.id,
  orders.reference,
  orders.user_id,
  orders.plan_key,
  orders.status,
  orders.paystack_reference,
  count(ledger.id) as grant_rows
from public.study_billing_orders as orders
left join public.study_credit_ledger as ledger
  on ledger.order_id = orders.id
  and ledger.reason in ('purchase', 'plus_grant')
where orders.payment_method = 'paystack'
  and orders.status <> 'approved'
  and (orders.paystack_reference is not null or ledger.id is not null)
group by orders.id
order by orders.created_at desc;

-- 4. Duplicate positive grants for one billing order.
select order_id, count(*) as grant_rows, sum(delta) as granted_credits
from public.study_credit_ledger
where order_id is not null
  and reason in ('purchase', 'plus_grant')
group by order_id
having count(*) > 1;
