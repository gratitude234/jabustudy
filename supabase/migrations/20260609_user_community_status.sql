-- Tracks whether a user has already been prompted to join official community channels.
-- This records app-side intent only; WhatsApp does not provide membership callbacks.

create table if not exists public.user_community_status (
  user_id uuid not null primary key references auth.users(id) on delete cascade,
  whatsapp_join_clicked_at timestamptz,
  whatsapp_join_confirmed_at timestamptz,
  whatsapp_dismissed_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_community_status enable row level security;

create policy "user_community_status_select_own"
  on public.user_community_status for select
  to authenticated
  using (user_id = auth.uid());

create policy "user_community_status_insert_own"
  on public.user_community_status for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "user_community_status_update_own"
  on public.user_community_status for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create trigger trg_user_community_status_updated_at
  before update on public.user_community_status
  for each row execute function public.set_updated_at();
