-- study_events — client-side event log for Study Hub baseline measurement
create table if not exists public.study_events (
  id         bigserial primary key,
  user_id    uuid references auth.users(id) on delete set null,
  session_id text,
  event_name text not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists study_events_user_created_idx
  on public.study_events (user_id, created_at desc);
create index if not exists study_events_event_created_idx
  on public.study_events (event_name, created_at desc);
create index if not exists study_events_session_idx
  on public.study_events (session_id, created_at);

alter table public.study_events enable row level security;

create policy "study_events_insert_own"
  on public.study_events for insert
  to authenticated, anon
  with check (user_id is null or user_id = auth.uid());

create or replace view public.study_events_home_summary as
select
  event_name,
  properties->>'cta'         as cta,
  properties->>'widget'      as widget,
  properties->>'hero_state'  as hero_state,
  count(*)                   as n,
  count(distinct user_id)    as unique_users,
  date_trunc('day', created_at) as day
from public.study_events
where event_name like 'study_home_%'
group by 1,2,3,4,7
order by day desc, n desc;
