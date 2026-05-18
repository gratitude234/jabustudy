-- Align live Study Hub schema with the current application code.
-- These columns are read/written by study-admin and rep upload flows.

alter table public.study_reps
  add column if not exists active boolean not null default true;

alter table public.study_courses
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists approved_at timestamptz;

alter table public.study_materials
  add column if not exists down_votes int not null default 0;
