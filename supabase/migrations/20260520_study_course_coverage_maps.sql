-- Durable course coverage maps for source-backed question generation.

create table if not exists public.study_course_maps (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.study_courses(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'building', 'stale', 'failed')),
  version text not null default 'coverage-engine-v1',
  generated_from_material_ids jsonb not null default '[]'::jsonb,
  coverage_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_course_topics (
  id uuid primary key default gen_random_uuid(),
  course_map_id uuid not null references public.study_course_maps(id) on delete cascade,
  course_id uuid not null references public.study_courses(id) on delete cascade,
  title text not null,
  normalized_key text not null,
  summary text,
  importance integer not null default 3 check (importance between 1 and 5),
  target_question_count integer not null default 3 check (target_question_count >= 1),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.study_course_subtopics (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.study_course_topics(id) on delete cascade,
  title text not null,
  normalized_key text not null,
  summary text,
  importance integer not null default 3 check (importance between 1 and 5),
  target_question_count integer not null default 2 check (target_question_count >= 1),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.study_course_subtopic_chunks (
  id uuid primary key default gen_random_uuid(),
  subtopic_id uuid not null references public.study_course_subtopics(id) on delete cascade,
  material_id uuid not null references public.study_materials(id) on delete cascade,
  chunk_id uuid not null references public.study_material_chunks(id) on delete cascade,
  relevance_score numeric not null default 0.75 check (relevance_score >= 0 and relevance_score <= 1),
  source_confidence numeric not null default 0.75 check (source_confidence >= 0 and source_confidence <= 1),
  created_at timestamptz not null default now(),
  unique (subtopic_id, chunk_id)
);

create unique index if not exists study_course_maps_active_course_idx
  on public.study_course_maps(course_id)
  where status = 'active';

create index if not exists study_course_maps_course_idx
  on public.study_course_maps(course_id, status);

create index if not exists study_course_topics_map_idx
  on public.study_course_topics(course_map_id, sort_order);

create index if not exists study_course_topics_course_idx
  on public.study_course_topics(course_id);

create index if not exists study_course_subtopics_topic_idx
  on public.study_course_subtopics(topic_id, sort_order);

create index if not exists study_course_subtopic_chunks_subtopic_idx
  on public.study_course_subtopic_chunks(subtopic_id);

create index if not exists study_course_subtopic_chunks_material_idx
  on public.study_course_subtopic_chunks(material_id);

create index if not exists study_course_subtopic_chunks_chunk_idx
  on public.study_course_subtopic_chunks(chunk_id);

comment on table public.study_course_maps is
  'Durable AI-assisted course maps used to score source-backed question coverage.';

comment on table public.study_course_subtopic_chunks is
  'Maps examinable course subtopics to concrete indexed study material chunks.';
