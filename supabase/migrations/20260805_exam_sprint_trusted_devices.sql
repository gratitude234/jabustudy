-- Exam Sprint account-sharing guardrails.
--
-- Students may trust at most two devices, while only one trusted device may
-- actively use Exam Sprint at a time. The active-device lease is intentionally
-- short-lived and refreshed by exam API activity; this avoids IP-based locks
-- and behaves well on Nigerian mobile networks.

create table if not exists public.study_exam_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null,
  device_label text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint study_exam_devices_token_hash_check check (char_length(token_hash) = 64),
  constraint study_exam_devices_label_check check (char_length(device_label) between 1 and 80),
  constraint study_exam_devices_user_token_key unique (user_id, token_hash)
);

create index if not exists study_exam_devices_active_user_idx
  on public.study_exam_devices (user_id, last_seen_at desc)
  where revoked_at is null;

create table if not exists public.study_exam_device_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  device_id uuid not null references public.study_exam_devices(id) on delete cascade,
  claimed_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists study_exam_device_sessions_device_idx
  on public.study_exam_device_sessions (device_id);

alter table public.study_exam_devices enable row level security;
alter table public.study_exam_device_sessions enable row level security;

revoke all on table public.study_exam_devices from anon, authenticated;
revoke all on table public.study_exam_device_sessions from anon, authenticated;
grant select, insert, update, delete on table public.study_exam_devices to service_role;
grant select, insert, update, delete on table public.study_exam_device_sessions to service_role;

-- Registering is serialized per user so two simultaneous new phones cannot
-- race past the two-device ceiling.
create or replace function public.register_exam_sprint_device(
  p_user_id uuid,
  p_token_hash text,
  p_device_label text,
  p_max_devices integer default 2
)
returns table (
  device_id uuid,
  created boolean,
  active_count integer
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_existing public.study_exam_devices%rowtype;
  v_device_id uuid;
  v_active_count integer;
  v_limit integer := greatest(1, least(coalesce(p_max_devices, 2), 5));
begin
  if p_user_id is null
     or p_token_hash is null
     or char_length(p_token_hash) <> 64
     or nullif(trim(p_device_label), '') is null then
    raise exception using errcode = '22023', message = 'EXAM_DEVICE_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text)::bigint);

  select d.* into v_existing
    from public.study_exam_devices d
   where d.user_id = p_user_id
     and d.token_hash = p_token_hash
   limit 1;

  if found then
    if v_existing.revoked_at is not null then
      raise exception using errcode = 'P0001', message = 'EXAM_DEVICE_REVOKED';
    end if;

    update public.study_exam_devices
       set device_label = left(trim(p_device_label), 80),
           last_seen_at = now()
     where id = v_existing.id;

    select count(*)::integer into v_active_count
      from public.study_exam_devices d
     where d.user_id = p_user_id and d.revoked_at is null;

    return query select v_existing.id, false, v_active_count;
    return;
  end if;

  select count(*)::integer into v_active_count
    from public.study_exam_devices d
   where d.user_id = p_user_id and d.revoked_at is null;

  if v_active_count >= v_limit then
    raise exception using errcode = 'P0001', message = 'EXAM_DEVICE_LIMIT';
  end if;

  insert into public.study_exam_devices (user_id, token_hash, device_label)
  values (p_user_id, p_token_hash, left(trim(p_device_label), 80))
  returning id into v_device_id;

  return query select v_device_id, true, v_active_count + 1;
end;
$$;

-- Verify the private device token and atomically acquire/refresh the user's
-- single Exam Sprint lease. Exact IP addresses are never part of this decision.
create or replace function public.use_exam_sprint_device_session(
  p_user_id uuid,
  p_token_hash text,
  p_force boolean default false,
  p_lease_seconds integer default 900
)
returns table (
  state text,
  allowed boolean,
  current_device_id uuid,
  active_device_id uuid,
  active_device_label text,
  active_last_seen_at timestamptz,
  active_expires_at timestamptz
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_device public.study_exam_devices%rowtype;
  v_active_device_id uuid;
  v_active_label text;
  v_active_last_seen timestamptz;
  v_active_expires timestamptz;
  v_now timestamptz := clock_timestamp();
  v_lease interval := make_interval(secs => greatest(60, least(coalesce(p_lease_seconds, 900), 3600)));
begin
  if p_user_id is null or nullif(trim(coalesce(p_token_hash, '')), '') is null then
    return query select 'device_required'::text, false, null::uuid, null::uuid, null::text, null::timestamptz, null::timestamptz;
    return;
  end if;

  select d.* into v_device
    from public.study_exam_devices d
   where d.user_id = p_user_id
     and d.token_hash = p_token_hash
   limit 1;

  if not found then
    return query select 'device_required'::text, false, null::uuid, null::uuid, null::text, null::timestamptz, null::timestamptz;
    return;
  end if;

  if v_device.revoked_at is not null then
    return query select 'device_revoked'::text, false, null::uuid, null::uuid, null::text, null::timestamptz, null::timestamptz;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text)::bigint);

  select s.device_id, d.device_label, s.last_seen_at, s.expires_at
    into v_active_device_id, v_active_label, v_active_last_seen, v_active_expires
    from public.study_exam_device_sessions s
    left join public.study_exam_devices d
      on d.id = s.device_id and d.revoked_at is null
   where s.user_id = p_user_id;

  if not found
     or v_active_label is null
     or v_active_expires <= v_now
     or v_active_device_id = v_device.id
     or coalesce(p_force, false) then
    insert into public.study_exam_device_sessions (
      user_id, device_id, claimed_at, last_seen_at, expires_at
    ) values (
      p_user_id, v_device.id, v_now, v_now, v_now + v_lease
    )
    on conflict (user_id) do update
      set device_id = excluded.device_id,
          claimed_at = case
            when public.study_exam_device_sessions.device_id = excluded.device_id
              then public.study_exam_device_sessions.claimed_at
            else excluded.claimed_at
          end,
          last_seen_at = excluded.last_seen_at,
          expires_at = excluded.expires_at;

    update public.study_exam_devices
       set last_seen_at = v_now
     where id = v_device.id;

    return query select
      'ok'::text,
      true,
      v_device.id,
      v_device.id,
      v_device.device_label,
      v_now,
      v_now + v_lease;
    return;
  end if;

  return query select
    'session_in_use'::text,
    false,
    v_device.id,
    v_active_device_id,
    v_active_label,
    v_active_last_seen,
    v_active_expires;
end;
$$;

revoke all on function public.register_exam_sprint_device(uuid, text, text, integer)
  from public, anon, authenticated;
revoke all on function public.use_exam_sprint_device_session(uuid, text, boolean, integer)
  from public, anon, authenticated;

grant execute on function public.register_exam_sprint_device(uuid, text, text, integer)
  to service_role;
grant execute on function public.use_exam_sprint_device_session(uuid, text, boolean, integer)
  to service_role;
