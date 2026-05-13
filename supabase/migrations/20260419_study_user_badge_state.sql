-- study_user_badge_state — per-user last-seen timestamps for the More sheet's "new" counts
create table if not exists public.study_user_badge_state (
  user_id      uuid references auth.users(id) on delete cascade,
  area         text not null,
  last_seen_at timestamptz not null default now(),
  primary key (user_id, area)
);

create index if not exists study_user_badge_state_user_idx
  on public.study_user_badge_state (user_id);

alter table public.study_user_badge_state enable row level security;

create policy "study_user_badge_state_select_own"
  on public.study_user_badge_state for select
  to authenticated
  using (user_id = auth.uid());

create policy "study_user_badge_state_insert_own"
  on public.study_user_badge_state for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "study_user_badge_state_update_own"
  on public.study_user_badge_state for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
