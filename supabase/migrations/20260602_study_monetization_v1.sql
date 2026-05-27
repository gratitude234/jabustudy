-- Monetization v1: manual transfer orders, Plus entitlements, credit ledger, and usage gates.

create table if not exists public.study_billing_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_type text not null check (product_type in ('plus', 'credits')),
  plan_key text not null check (plan_key in ('plus_weekly', 'plus_monthly', 'credits_20', 'credits_50', 'credits_100')),
  amount_naira integer not null check (amount_naira > 0),
  credits integer not null default 0 check (credits >= 0),
  plus_days integer check (plus_days is null or plus_days > 0),
  reference text not null unique,
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'pending_review', 'approved', 'rejected', 'cancelled')),
  receipt_path text,
  sender_name text,
  sender_bank text,
  transaction_reference text,
  submitted_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists study_billing_orders_user_created_idx
on public.study_billing_orders (user_id, created_at desc);

create index if not exists study_billing_orders_status_created_idx
on public.study_billing_orders (status, created_at desc);

create table if not exists public.study_plus_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_key text not null check (plan_key in ('plus_weekly', 'plus_monthly')),
  active_until timestamptz not null,
  last_order_id uuid references public.study_billing_orders(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists study_plus_entitlements_active_until_idx
on public.study_plus_entitlements (active_until desc);

create table if not exists public.study_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null,
  balance_after integer not null check (balance_after >= 0),
  reason text not null check (reason in (
    'purchase',
    'plus_grant',
    'generation_spend',
    'free_monthly_generation',
    'admin_adjustment',
    'legacy'
  )),
  order_id uuid references public.study_billing_orders(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists study_credit_ledger_user_created_idx
on public.study_credit_ledger (user_id, created_at desc);

create table if not exists public.study_monetization_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_type text not null check (usage_type in ('free_ai_generation', 'practice_questions')),
  period_key text not null,
  used_count integer not null default 0 check (used_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, usage_type, period_key)
);

create index if not exists study_monetization_usage_type_period_idx
on public.study_monetization_usage (usage_type, period_key, updated_at desc);

alter table public.study_billing_orders enable row level security;
alter table public.study_plus_entitlements enable row level security;
alter table public.study_credit_ledger enable row level security;
alter table public.study_monetization_usage enable row level security;

drop policy if exists "study_billing_orders_own_select" on public.study_billing_orders;
create policy "study_billing_orders_own_select"
on public.study_billing_orders for select
using (auth.uid() = user_id);

drop policy if exists "study_plus_entitlements_own_select" on public.study_plus_entitlements;
create policy "study_plus_entitlements_own_select"
on public.study_plus_entitlements for select
using (auth.uid() = user_id);

drop policy if exists "study_credit_ledger_own_select" on public.study_credit_ledger;
create policy "study_credit_ledger_own_select"
on public.study_credit_ledger for select
using (auth.uid() = user_id);

drop policy if exists "study_monetization_usage_own_select" on public.study_monetization_usage;
create policy "study_monetization_usage_own_select"
on public.study_monetization_usage for select
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('payment-receipts', 'payment-receipts', false)
on conflict (id) do update set public = false;

alter table public.study_user_credits
  alter column balance set default 0;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, updated_at)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    now()
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        updated_at = now();

  insert into public.study_user_credits (user_id, balance, updated_at)
  values (new.id, 0, now())
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create or replace function public.grant_study_user_credits(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_order_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table(ok boolean, balance integer, code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_user_id is null then
    return query select false, null::integer, 'MISSING_USER';
    return;
  end if;

  if p_amount is null or p_amount <= 0 then
    return query select false, null::integer, 'INVALID_AMOUNT';
    return;
  end if;

  if p_reason not in ('purchase', 'plus_grant', 'admin_adjustment') then
    return query select false, null::integer, 'INVALID_REASON';
    return;
  end if;

  insert into public.study_user_credits(user_id, balance, updated_at)
  values (p_user_id, p_amount, now())
  on conflict (user_id) do update
    set balance = public.study_user_credits.balance + excluded.balance,
        updated_at = now()
  returning public.study_user_credits.balance into v_balance;

  insert into public.study_credit_ledger(user_id, delta, balance_after, reason, order_id, metadata)
  values (p_user_id, p_amount, v_balance, p_reason, p_order_id, coalesce(p_metadata, '{}'::jsonb));

  return query select true, v_balance, 'OK';
end;
$$;

revoke all on function public.grant_study_user_credits(uuid, integer, text, uuid, jsonb) from public;
grant execute on function public.grant_study_user_credits(uuid, integer, text, uuid, jsonb) to service_role;

create or replace function public.spend_study_user_credits(
  p_user_id uuid,
  p_cost integer,
  p_default_balance integer default 0
)
returns table(ok boolean, balance integer, code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_user_id is null then
    return query select false, null::integer, 'MISSING_USER';
    return;
  end if;

  if p_cost is null or p_cost < 0 then
    return query select false, null::integer, 'INVALID_COST';
    return;
  end if;

  insert into public.study_user_credits(user_id, balance, updated_at)
  values (p_user_id, coalesce(p_default_balance, 0), now())
  on conflict (user_id) do nothing;

  if p_cost = 0 then
    select suc.balance
      into v_balance
      from public.study_user_credits suc
      where suc.user_id = p_user_id;

    return query select true, coalesce(v_balance, 0), 'OK';
    return;
  end if;

  update public.study_user_credits as suc
    set balance = suc.balance - p_cost,
        updated_at = now()
    where suc.user_id = p_user_id
      and suc.balance >= p_cost
    returning suc.balance into v_balance;

  if v_balance is null then
    select suc.balance
      into v_balance
      from public.study_user_credits suc
      where suc.user_id = p_user_id;

    return query select false, coalesce(v_balance, 0), 'INSUFFICIENT_CREDITS';
    return;
  end if;

  insert into public.study_credit_ledger(user_id, delta, balance_after, reason, metadata)
  values (p_user_id, -p_cost, v_balance, 'generation_spend', jsonb_build_object('cost', p_cost));

  return query select true, v_balance, 'OK';
end;
$$;

revoke all on function public.spend_study_user_credits(uuid, integer, integer) from public;
grant execute on function public.spend_study_user_credits(uuid, integer, integer) to service_role;

create or replace function public.increment_study_monetization_usage(
  p_user_id uuid,
  p_usage_type text,
  p_period_key text,
  p_amount integer,
  p_limit integer,
  p_metadata jsonb default '{}'::jsonb
)
returns table(ok boolean, used_count integer, remaining integer, code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used integer;
begin
  if p_user_id is null then
    return query select false, 0, 0, 'MISSING_USER';
    return;
  end if;

  if p_usage_type not in ('free_ai_generation', 'practice_questions') then
    return query select false, 0, 0, 'INVALID_USAGE_TYPE';
    return;
  end if;

  if p_period_key is null or length(trim(p_period_key)) = 0 then
    return query select false, 0, 0, 'INVALID_PERIOD';
    return;
  end if;

  if p_amount is null or p_amount <= 0 or p_limit is null or p_limit < 0 then
    return query select false, 0, 0, 'INVALID_AMOUNT';
    return;
  end if;

  insert into public.study_monetization_usage(user_id, usage_type, period_key, used_count, metadata, updated_at)
  values (p_user_id, p_usage_type, p_period_key, 0, '{}'::jsonb, now())
  on conflict (user_id, usage_type, period_key) do nothing;

  update public.study_monetization_usage as smu
    set used_count = smu.used_count + p_amount,
        metadata = coalesce(smu.metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
        updated_at = now()
    where smu.user_id = p_user_id
      and smu.usage_type = p_usage_type
      and smu.period_key = p_period_key
      and smu.used_count + p_amount <= p_limit
    returning smu.used_count into v_used;

  if v_used is null then
    select smu.used_count
      into v_used
      from public.study_monetization_usage smu
      where smu.user_id = p_user_id
        and smu.usage_type = p_usage_type
        and smu.period_key = p_period_key;

    return query select false, coalesce(v_used, 0), greatest(0, p_limit - coalesce(v_used, 0)), 'LIMIT_REACHED';
    return;
  end if;

  return query select true, v_used, greatest(0, p_limit - v_used), 'OK';
end;
$$;

revoke all on function public.increment_study_monetization_usage(uuid, text, text, integer, integer, jsonb) from public;
grant execute on function public.increment_study_monetization_usage(uuid, text, text, integer, integer, jsonb) to service_role;
