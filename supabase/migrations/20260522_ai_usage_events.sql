create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  endpoint text not null,
  route text,
  provider text,
  model text,
  status text not null check (status in ('success', 'failure', 'blocked')),
  requested_count int,
  material_id uuid references public.study_materials(id) on delete set null,
  course_id uuid references public.study_courses(id) on delete set null,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_user_endpoint_created_idx
on public.ai_usage_events (user_id, endpoint, created_at desc);

create index if not exists ai_usage_events_endpoint_created_idx
on public.ai_usage_events (endpoint, created_at desc);

create index if not exists ai_usage_events_material_created_idx
on public.ai_usage_events (material_id, created_at desc)
where material_id is not null;

create index if not exists ai_usage_events_course_created_idx
on public.ai_usage_events (course_id, created_at desc)
where course_id is not null;

create index if not exists ai_usage_events_status_created_idx
on public.ai_usage_events (status, created_at desc);
