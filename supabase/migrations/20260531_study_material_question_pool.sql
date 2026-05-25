create table if not exists public.study_material_question_pool (
  id uuid primary key default gen_random_uuid(),
  source_material_id uuid not null references public.study_materials(id) on delete cascade,
  source_chunk_id uuid references public.study_material_chunks(id) on delete set null,
  prompt text not null,
  explanation text,
  question_type text not null default 'mcq' check (question_type in ('mcq', 'short_answer', 'theory')),
  answer_key text check (answer_key is null or answer_key in ('A', 'B', 'C', 'D')),
  model_answer text,
  marking_points jsonb not null default '[]'::jsonb,
  study_ref jsonb,
  question_kind text,
  difficulty_level text,
  cognitive_level text,
  source_topic text,
  question_fingerprint text,
  generation_meta jsonb,
  quality_status text not null default 'active' check (quality_status in ('active', 'verified', 'flagged', 'rejected')),
  ai_generated boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_from_set_id uuid references public.study_quiz_sets(id) on delete set null,
  created_from_question_id uuid references public.study_quiz_questions(id) on delete set null,
  usage_count integer not null default 0,
  reports_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_material_question_pool_options (
  id uuid primary key default gen_random_uuid(),
  pool_question_id uuid not null references public.study_material_question_pool(id) on delete cascade,
  text text not null,
  is_correct boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.study_user_question_pool_seen (
  user_id uuid not null references auth.users(id) on delete cascade,
  pool_question_id uuid not null references public.study_material_question_pool(id) on delete cascade,
  source_material_id uuid not null references public.study_materials(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  seen_count integer not null default 1,
  source_attempt_id uuid references public.study_practice_attempts(id) on delete set null,
  primary key (user_id, pool_question_id)
);

alter table public.study_quiz_questions
  add column if not exists pool_question_id uuid references public.study_material_question_pool(id) on delete set null;

create unique index if not exists study_material_question_pool_material_fingerprint_uidx
  on public.study_material_question_pool(source_material_id, question_fingerprint)
  where question_fingerprint is not null;

create index if not exists study_material_question_pool_reuse_idx
  on public.study_material_question_pool(source_material_id, quality_status, question_type, usage_count, created_at desc);

create index if not exists study_material_question_pool_topic_idx
  on public.study_material_question_pool(source_material_id, source_topic);

create index if not exists study_material_question_pool_options_question_idx
  on public.study_material_question_pool_options(pool_question_id, position);

create index if not exists study_user_question_pool_seen_material_idx
  on public.study_user_question_pool_seen(user_id, source_material_id, last_seen_at desc);

create index if not exists study_quiz_questions_pool_question_idx
  on public.study_quiz_questions(pool_question_id);

alter table public.study_material_question_pool enable row level security;
alter table public.study_material_question_pool_options enable row level security;
alter table public.study_user_question_pool_seen enable row level security;

create or replace function public.increment_study_material_question_pool_usage(p_ids uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.study_material_question_pool
    set usage_count = usage_count + 1,
        updated_at = now()
    where id = any(coalesce(p_ids, '{}'::uuid[]));
$$;

revoke all on function public.increment_study_material_question_pool_usage(uuid[]) from public;
grant execute on function public.increment_study_material_question_pool_usage(uuid[]) to service_role;
