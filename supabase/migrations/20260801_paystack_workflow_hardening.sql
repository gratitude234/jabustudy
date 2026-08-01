-- Harden Paystack checkout lifecycle and make paid-order fulfilment atomic.
-- Apply only after running supabase/paystack_preflight.sql and resolving any
-- approved orders that are missing their expected credit ledger entry.

begin;

alter table public.study_billing_orders
  drop constraint if exists study_billing_orders_status_check;

alter table public.study_billing_orders
  add constraint study_billing_orders_status_check
  check (status in (
    'initializing',
    'pending_payment',
    'pending_review',
    'approved',
    'failed',
    'abandoned',
    'expired',
    'rejected',
    'cancelled'
  ));

alter table public.study_billing_orders
  add column if not exists provider_status text,
  add column if not exists paystack_authorization_url text,
  add column if not exists initialized_at timestamptz,
  add column if not exists last_verified_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists failure_detail text,
  add column if not exists return_path text,
  add column if not exists refund_status text not null default 'none',
  add column if not exists refunded_at timestamptz,
  add column if not exists refund_amount_naira integer,
  add column if not exists refund_note text;

alter table public.study_billing_orders
  drop constraint if exists study_billing_orders_refund_status_check;

alter table public.study_billing_orders
  add constraint study_billing_orders_refund_status_check
  check (refund_status in ('none', 'pending_review', 'resolved'));

alter table public.study_billing_orders
  drop constraint if exists study_billing_orders_return_path_check;

alter table public.study_billing_orders
  add constraint study_billing_orders_return_path_check
  check (
    return_path is null
    or (
      length(return_path) <= 500
      and (return_path = '/study' or return_path like '/study/%')
      and return_path not like '/study/billing%'
      and return_path not like '//%'
      and position(E'\\' in return_path) = 0
    )
  );

-- Existing duplicate active checkouts would prevent the partial unique index.
-- Keep the newest one visible and make every older checkout recoverable through
-- verification: a later confirmed payment may still move an abandoned order to
-- approved through fulfil_paystack_billing_order().
with ranked_active as (
  select
    id,
    row_number() over (
      partition by user_id
      order by created_at desc, id desc
    ) as active_rank
  from public.study_billing_orders
  where payment_method = 'paystack'
    and status in ('initializing', 'pending_payment')
)
update public.study_billing_orders as orders
set
  status = 'abandoned',
  provider_status = coalesce(orders.provider_status, 'abandoned_locally'),
  failure_detail = coalesce(orders.failure_detail, 'Superseded by a newer Paystack checkout.'),
  updated_at = now()
from ranked_active
where ranked_active.id = orders.id
  and ranked_active.active_rank > 1;

create unique index if not exists study_billing_orders_one_active_paystack_idx
  on public.study_billing_orders (user_id)
  where payment_method = 'paystack'
    and status in ('initializing', 'pending_payment');

create index if not exists study_billing_orders_paystack_recovery_idx
  on public.study_billing_orders (payment_method, status, updated_at desc);

create index if not exists study_billing_orders_refund_review_idx
  on public.study_billing_orders (refund_status, refunded_at desc)
  where refund_status <> 'none';

create or replace function public.fulfil_paystack_billing_order(
  p_reference text,
  p_transaction_id text,
  p_amount_kobo bigint,
  p_currency text,
  p_paid_at timestamptz default null
)
returns table(
  ok boolean,
  code text,
  order_id uuid,
  order_status text,
  credit_balance integer,
  plus_active_until timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.study_billing_orders%rowtype;
  v_balance integer;
  v_current_until timestamptz;
  v_active_until timestamptz;
  v_reason text;
  v_now timestamptz := now();
begin
  if nullif(trim(coalesce(p_reference, '')), '') is null then
    return query select false, 'MISSING_REFERENCE', null::uuid, null::text, null::integer, null::timestamptz;
    return;
  end if;

  select * into v_order
  from public.study_billing_orders
  where reference = trim(p_reference)
  for update;

  if not found then
    return query select false, 'ORDER_NOT_FOUND', null::uuid, null::text, null::integer, null::timestamptz;
    return;
  end if;

  if v_order.payment_method <> 'paystack' then
    return query select false, 'WRONG_PAYMENT_METHOD', v_order.id, v_order.status, null::integer, null::timestamptz;
    return;
  end if;

  if v_order.refund_status <> 'none' then
    return query select false, 'REFUND_REVIEW_ACTIVE', v_order.id, v_order.status, null::integer, null::timestamptz;
    return;
  end if;

  if p_amount_kobo is null or p_amount_kobo <> (v_order.amount_naira::bigint * 100) then
    return query select false, 'AMOUNT_MISMATCH', v_order.id, v_order.status, null::integer, null::timestamptz;
    return;
  end if;

  if upper(trim(coalesce(p_currency, ''))) <> 'NGN' then
    return query select false, 'CURRENCY_MISMATCH', v_order.id, v_order.status, null::integer, null::timestamptz;
    return;
  end if;

  if nullif(trim(coalesce(p_transaction_id, '')), '') is null then
    return query select false, 'MISSING_TRANSACTION_ID', v_order.id, v_order.status, null::integer, null::timestamptz;
    return;
  end if;

  if v_order.status = 'approved' then
    if v_order.paystack_reference is distinct from trim(p_transaction_id) then
      return query select false, 'TRANSACTION_MISMATCH', v_order.id, v_order.status, null::integer, null::timestamptz;
      return;
    end if;

    select balance into v_balance
    from public.study_user_credits
    where user_id = v_order.user_id;

    select active_until into v_active_until
    from public.study_plus_entitlements
    where user_id = v_order.user_id;

    return query select true, 'ALREADY_FULFILLED', v_order.id, v_order.status, coalesce(v_balance, 0), v_active_until;
    return;
  end if;

  if v_order.status not in ('initializing', 'pending_payment', 'failed', 'abandoned', 'expired', 'cancelled') then
    return query select false, 'ORDER_NOT_FULFILLABLE', v_order.id, v_order.status, null::integer, null::timestamptz;
    return;
  end if;

  insert into public.study_user_credits(user_id, balance, updated_at)
  values (v_order.user_id, 0, v_now)
  on conflict (user_id) do nothing;

  select balance into v_balance
  from public.study_user_credits
  where user_id = v_order.user_id
  for update;

  if v_order.product_type = 'plus' then
    if v_order.plus_days is null or v_order.plus_days <= 0 then
      raise exception 'Plus order % has invalid plus_days', v_order.id;
    end if;

    select active_until into v_current_until
    from public.study_plus_entitlements
    where user_id = v_order.user_id
    for update;

    v_active_until := greatest(coalesce(v_current_until, v_now), v_now)
      + make_interval(days => v_order.plus_days);

    insert into public.study_plus_entitlements(
      user_id,
      plan_key,
      active_until,
      last_order_id,
      updated_at
    ) values (
      v_order.user_id,
      v_order.plan_key,
      v_active_until,
      v_order.id,
      v_now
    )
    on conflict (user_id) do update
      set plan_key = excluded.plan_key,
          active_until = excluded.active_until,
          last_order_id = excluded.last_order_id,
          updated_at = excluded.updated_at;

    v_reason := 'plus_grant';
  else
    v_reason := 'purchase';
  end if;

  if v_order.credits > 0 then
    update public.study_user_credits
    set balance = balance + v_order.credits,
        updated_at = v_now
    where user_id = v_order.user_id
    returning balance into v_balance;

    insert into public.study_credit_ledger(
      user_id,
      delta,
      balance_after,
      reason,
      order_id,
      metadata
    ) values (
      v_order.user_id,
      v_order.credits,
      v_balance,
      v_reason,
      v_order.id,
      jsonb_build_object(
        'planKey', v_order.plan_key,
        'paystackTransactionId', trim(p_transaction_id),
        'activeUntil', v_active_until
      )
    );
  end if;

  update public.study_billing_orders
  set status = 'approved',
      provider_status = 'success',
      paystack_reference = trim(p_transaction_id),
      paid_at = coalesce(p_paid_at, v_now),
      last_verified_at = v_now,
      reviewed_by = null,
      reviewed_at = v_now,
      admin_note = 'paystack-auto',
      failure_detail = null,
      updated_at = v_now
  where id = v_order.id;

  insert into public.notifications(user_id, type, title, body, href)
  values (
    v_order.user_id,
    'billing',
    'Payment confirmed',
    case v_order.plan_key
      when 'plus_weekly' then 'JabuStudy Plus Weekly is now active on your account.'
      when 'plus_monthly' then 'JabuStudy Plus Monthly is now active on your account.'
      when 'credits_20' then '20 AI Credits are now available on your account.'
      when 'credits_50' then '50 AI Credits are now available on your account.'
      when 'credits_100' then '100 AI Credits are now available on your account.'
      else 'Your purchase is now active on your account.'
    end,
    '/study/billing'
  );

  return query select true, 'FULFILLED', v_order.id, 'approved', coalesce(v_balance, 0), v_active_until;
end;
$$;

revoke all on function public.fulfil_paystack_billing_order(text, text, bigint, text, timestamptz) from public;
grant execute on function public.fulfil_paystack_billing_order(text, text, bigint, text, timestamptz) to service_role;

create or replace function public.flag_paystack_refund(
  p_reference text,
  p_transaction_id text,
  p_amount_kobo bigint,
  p_currency text,
  p_refunded_at timestamptz default null,
  p_note text default null
)
returns table(ok boolean, code text, order_id uuid, refund_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.study_billing_orders%rowtype;
  v_now timestamptz := now();
begin
  select * into v_order
  from public.study_billing_orders
  where (
    nullif(trim(coalesce(p_reference, '')), '') is not null
    and reference = trim(p_reference)
  ) or (
    nullif(trim(coalesce(p_transaction_id, '')), '') is not null
    and paystack_reference = trim(p_transaction_id)
  )
  order by case when reference = trim(coalesce(p_reference, '')) then 0 else 1 end
  limit 1
  for update;

  if not found then
    return query select false, 'ORDER_NOT_FOUND', null::uuid, null::text;
    return;
  end if;

  if v_order.payment_method <> 'paystack' then
    return query select false, 'WRONG_PAYMENT_METHOD', v_order.id, v_order.refund_status;
    return;
  end if;

  if v_order.refund_status <> 'none' then
    return query select true, 'ALREADY_FLAGGED', v_order.id, v_order.refund_status;
    return;
  end if;

  if upper(trim(coalesce(p_currency, ''))) <> 'NGN' then
    return query select false, 'CURRENCY_MISMATCH', v_order.id, v_order.refund_status;
    return;
  end if;

  if p_amount_kobo is null or p_amount_kobo <= 0 or p_amount_kobo > (v_order.amount_naira::bigint * 100) then
    return query select false, 'REFUND_AMOUNT_MISMATCH', v_order.id, v_order.refund_status;
    return;
  end if;

  update public.study_billing_orders
  set refund_status = 'pending_review',
      refunded_at = coalesce(p_refunded_at, v_now),
      refund_amount_naira = (p_amount_kobo / 100)::integer,
      refund_note = nullif(left(trim(coalesce(p_note, '')), 500), ''),
      provider_status = 'refunded',
      last_verified_at = v_now,
      updated_at = v_now
  where id = v_order.id;

  insert into public.notifications(user_id, type, title, body, href)
  select
    admins.user_id,
    'billing_refund_review',
    'Refund needs review',
    'Paystack reported a refund for order ' || v_order.reference || '. Review the granted benefits.',
    '/study-admin/billing'
  from public.study_admins as admins;

  return query select true, 'FLAGGED', v_order.id, 'pending_review';
end;
$$;

revoke all on function public.flag_paystack_refund(text, text, bigint, text, timestamptz, text) from public;
grant execute on function public.flag_paystack_refund(text, text, bigint, text, timestamptz, text) to service_role;

create or replace function public.fulfil_manual_billing_order(
  p_order_id uuid,
  p_reviewer_id uuid,
  p_note text default null
)
returns table(ok boolean, code text, order_id uuid, order_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.study_billing_orders%rowtype;
  v_balance integer;
  v_current_until timestamptz;
  v_active_until timestamptz;
  v_reason text;
  v_now timestamptz := now();
begin
  select * into v_order
  from public.study_billing_orders
  where id = p_order_id
  for update;

  if not found then
    return query select false, 'ORDER_NOT_FOUND', null::uuid, null::text;
    return;
  end if;

  if v_order.payment_method <> 'manual' then
    return query select false, 'WRONG_PAYMENT_METHOD', v_order.id, v_order.status;
    return;
  end if;

  if v_order.status = 'approved' then
    return query select true, 'ALREADY_FULFILLED', v_order.id, v_order.status;
    return;
  end if;

  if v_order.status <> 'pending_review' then
    return query select false, 'ORDER_NOT_REVIEWABLE', v_order.id, v_order.status;
    return;
  end if;

  insert into public.study_user_credits(user_id, balance, updated_at)
  values (v_order.user_id, 0, v_now)
  on conflict (user_id) do nothing;

  select balance into v_balance
  from public.study_user_credits
  where user_id = v_order.user_id
  for update;

  if v_order.product_type = 'plus' then
    if v_order.plus_days is null or v_order.plus_days <= 0 then
      raise exception 'Plus order % has invalid plus_days', v_order.id;
    end if;

    select active_until into v_current_until
    from public.study_plus_entitlements
    where user_id = v_order.user_id
    for update;

    v_active_until := greatest(coalesce(v_current_until, v_now), v_now)
      + make_interval(days => v_order.plus_days);

    insert into public.study_plus_entitlements(user_id, plan_key, active_until, last_order_id, updated_at)
    values (v_order.user_id, v_order.plan_key, v_active_until, v_order.id, v_now)
    on conflict (user_id) do update
      set plan_key = excluded.plan_key,
          active_until = excluded.active_until,
          last_order_id = excluded.last_order_id,
          updated_at = excluded.updated_at;

    v_reason := 'plus_grant';
  else
    v_reason := 'purchase';
  end if;

  if v_order.credits > 0 then
    update public.study_user_credits
    set balance = balance + v_order.credits,
        updated_at = v_now
    where user_id = v_order.user_id
    returning balance into v_balance;

    insert into public.study_credit_ledger(user_id, delta, balance_after, reason, order_id, metadata)
    values (
      v_order.user_id,
      v_order.credits,
      v_balance,
      v_reason,
      v_order.id,
      jsonb_build_object('planKey', v_order.plan_key, 'activeUntil', v_active_until)
    );
  end if;

  update public.study_billing_orders
  set status = 'approved',
      provider_status = 'manual_approved',
      paid_at = coalesce(v_order.submitted_at, v_now),
      reviewed_by = p_reviewer_id,
      reviewed_at = v_now,
      admin_note = nullif(left(trim(coalesce(p_note, '')), 500), ''),
      failure_detail = null,
      updated_at = v_now
  where id = v_order.id;

  insert into public.notifications(user_id, type, title, body, href)
  values (
    v_order.user_id,
    'billing',
    'Payment approved',
    case v_order.plan_key
      when 'plus_weekly' then 'JabuStudy Plus Weekly is now active on your account.'
      when 'plus_monthly' then 'JabuStudy Plus Monthly is now active on your account.'
      when 'credits_20' then '20 AI Credits are now available on your account.'
      when 'credits_50' then '50 AI Credits are now available on your account.'
      when 'credits_100' then '100 AI Credits are now available on your account.'
      else 'Your purchase is now active on your account.'
    end,
    '/study/billing'
  );

  return query select true, 'FULFILLED', v_order.id, 'approved';
end;
$$;

revoke all on function public.fulfil_manual_billing_order(uuid, uuid, text) from public;
grant execute on function public.fulfil_manual_billing_order(uuid, uuid, text) to service_role;

commit;
