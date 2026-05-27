-- Fix handle_new_user() signup trigger to grant 4 starting credits (= one 20-question session).
-- The 20260602_study_monetization_v1 migration accidentally redefined this function with
-- balance = 0, overwriting the 20260527_auth_signup_profile_bootstrap definition.

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
  values (new.id, 4, now())
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Backfill users who signed up while the regression was active and received 0 credits.
-- Only affects users with balance = 0 AND no credit ledger history — anyone who
-- legitimately spent down to 0 will have ledger rows and is skipped.

with affected as (
  select suc.user_id
  from public.study_user_credits suc
  where suc.balance = 0
    and not exists (
      select 1 from public.study_credit_ledger scl
      where scl.user_id = suc.user_id
    )
),
updated as (
  update public.study_user_credits
  set balance = 4, updated_at = now()
  where user_id in (select user_id from affected)
  returning user_id
)
insert into public.study_credit_ledger (user_id, delta, balance_after, reason, metadata)
select
  user_id,
  4,
  4,
  'admin_adjustment',
  jsonb_build_object('note', 'signup_credit_backfill')
from updated;
