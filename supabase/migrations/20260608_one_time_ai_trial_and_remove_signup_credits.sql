-- Switch AI generation from recurring monthly freebies to one lifetime free trial.
-- Also stop granting signup credits and remove unused signup-only balances.

alter table public.study_monetization_usage
  drop constraint if exists study_monetization_usage_usage_type_check;

alter table public.study_monetization_usage
  add constraint study_monetization_usage_usage_type_check
  check (usage_type in ('free_ai_generation', 'free_ai_trial_generation', 'practice_questions'));

alter table public.study_credit_ledger
  drop constraint if exists study_credit_ledger_reason_check;

alter table public.study_credit_ledger
  add constraint study_credit_ledger_reason_check
  check (reason in (
    'purchase',
    'plus_grant',
    'generation_spend',
    'free_monthly_generation',
    'free_trial_generation',
    'admin_adjustment',
    'legacy'
  ));

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

  if p_usage_type not in ('free_ai_generation', 'free_ai_trial_generation', 'practice_questions') then
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

-- Users with a positive balance and no ledger history only have trigger-granted signup credits.
with signup_only_candidates as (
  select suc.user_id, suc.balance as removed_amount
  from public.study_user_credits suc
  where suc.balance > 0
    and not exists (
      select 1
      from public.study_credit_ledger scl
      where scl.user_id = suc.user_id
    )
),
removed_signup_only as (
  update public.study_user_credits suc
    set balance = 0,
        updated_at = now()
    from signup_only_candidates c
    where suc.user_id = c.user_id
    returning suc.user_id, c.removed_amount
)
insert into public.study_credit_ledger (user_id, delta, balance_after, reason, metadata)
select
  user_id,
  -removed_amount,
  0,
  'admin_adjustment',
  jsonb_build_object('note', 'remove_signup_only_credits')
from removed_signup_only
where removed_amount > 0;

-- Older signup credits may have spend ledger rows but no paid/admin credit source.
with legacy_signup_remainders as (
  select suc.user_id, suc.balance as remove_amount
  from public.study_user_credits suc
  where suc.balance > 0
    and exists (
      select 1
      from public.study_credit_ledger scl
      where scl.user_id = suc.user_id
    )
    and not exists (
      select 1
      from public.study_credit_ledger scl
      where scl.user_id = suc.user_id
        and scl.reason in ('purchase', 'plus_grant', 'admin_adjustment', 'legacy')
    )
    and not exists (
      select 1
      from public.study_credit_ledger scl
      where scl.user_id = suc.user_id
        and scl.reason = 'admin_adjustment'
        and scl.metadata ->> 'note' = 'remove_legacy_signup_credit_balance'
    )
),
removed_legacy_signup_remainders as (
  update public.study_user_credits suc
    set balance = 0,
        updated_at = now()
    from legacy_signup_remainders l
    where suc.user_id = l.user_id
    returning suc.user_id, l.remove_amount
)
insert into public.study_credit_ledger (user_id, delta, balance_after, reason, metadata)
select
  user_id,
  -remove_amount,
  0,
  'admin_adjustment',
  jsonb_build_object('note', 'remove_legacy_signup_credit_balance')
from removed_legacy_signup_remainders
where remove_amount > 0;

-- Users backfilled to 4 credits should lose only the remaining unused backfill amount.
with backfilled as (
  select suc.user_id, least(suc.balance, 4) as remove_amount
  from public.study_user_credits suc
  where suc.balance > 0
    and exists (
      select 1
      from public.study_credit_ledger scl
      where scl.user_id = suc.user_id
        and scl.reason = 'admin_adjustment'
        and scl.metadata ->> 'note' = 'signup_credit_backfill'
    )
    and not exists (
      select 1
      from public.study_credit_ledger scl
      where scl.user_id = suc.user_id
        and scl.reason in ('purchase', 'plus_grant')
    )
    and not exists (
      select 1
      from public.study_credit_ledger scl
      where scl.user_id = suc.user_id
        and scl.reason = 'admin_adjustment'
        and scl.metadata ->> 'note' = 'remove_signup_backfill_credits'
    )
),
updated_backfilled as (
  update public.study_user_credits suc
    set balance = greatest(0, suc.balance - b.remove_amount),
        updated_at = now()
    from backfilled b
    where suc.user_id = b.user_id
      and b.remove_amount > 0
    returning suc.user_id, b.remove_amount, suc.balance
)
insert into public.study_credit_ledger (user_id, delta, balance_after, reason, metadata)
select
  user_id,
  -remove_amount,
  balance,
  'admin_adjustment',
  jsonb_build_object('note', 'remove_signup_backfill_credits')
from updated_backfilled;
