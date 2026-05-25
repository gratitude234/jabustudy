create or replace function public.spend_study_user_credits(
  p_user_id uuid,
  p_cost integer,
  p_default_balance integer default 20
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
  values (p_user_id, coalesce(p_default_balance, 20), now())
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

  return query select true, v_balance, 'OK';
end;
$$;

revoke all on function public.spend_study_user_credits(uuid, integer, integer) from public;
grant execute on function public.spend_study_user_credits(uuid, integer, integer) to service_role;
