-- Jabu Study fresh Supabase bootstrap
-- Run this in the Supabase SQL editor for the new Study Hub project.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'system',
  title text not null,
  body text,
  href text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.user_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_faculties (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.study_departments (
  id uuid primary key default gen_random_uuid(),
  faculty_id uuid references public.study_faculties(id) on delete cascade,
  name text not null,
  sort_order int not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (faculty_id, name)
);

create table if not exists public.study_courses (
  id uuid primary key default gen_random_uuid(),
  faculty text,
  department text,
  level int not null,
  semester text not null check (semester in ('first', 'second', 'summer')),
  course_code text not null,
  course_title text,
  faculty_id uuid references public.study_faculties(id) on delete set null,
  department_id uuid references public.study_departments(id) on delete set null,
  status text not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists study_courses_unique_scope_idx
on public.study_courses (department_id, level, semester, upper(replace(course_code, ' ', '')));

create table if not exists public.study_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  faculty text,
  department text,
  level int,
  semester text,
  session text,
  faculty_id uuid references public.study_faculties(id) on delete set null,
  department_id uuid references public.study_departments(id) on delete set null,
  last_study_plan text,
  last_study_plan_at timestamptz,
  last_study_plan_progress jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_academic_calendar (
  id uuid primary key default gen_random_uuid(),
  session text not null,
  semester text not null check (semester in ('first', 'second', 'summer')),
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  unique (session, semester)
);

create table if not exists public.study_materials (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.study_courses(id) on delete set null,
  title text not null,
  description text,
  material_type text,
  session text,
  file_path text,
  file_url text,
  mime_type text,
  file_size bigint,
  file_hash text,
  gemini_file_uri text,
  approved boolean not null default false,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  rejection_reason text,
  upload_status text not null default 'live',
  uploader_id uuid references auth.users(id) on delete set null,
  uploader_email text,
  downloads int not null default 0,
  up_votes int not null default 0,
  featured boolean not null default false,
  verified boolean not null default false,
  ai_summary text,
  past_question_year int,
  course_code text,
  faculty text,
  department text,
  level text,
  semester text,
  faculty_id uuid references public.study_faculties(id) on delete set null,
  department_id uuid references public.study_departments(id) on delete set null,
  index_status text,
  indexed_at timestamptz,
  index_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists study_materials_course_idx on public.study_materials(course_id);
create index if not exists study_materials_filter_idx on public.study_materials(department_id, level, semester, approved, upload_status);
create index if not exists study_materials_created_idx on public.study_materials(created_at desc);

create table if not exists public.study_material_ratings (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.study_materials(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote int not null default 1,
  created_at timestamptz not null default now(),
  unique (material_id, user_id)
);

create table if not exists public.study_material_chunks (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.study_materials(id) on delete cascade,
  chunk_index int not null,
  page int,
  heading text,
  content text not null,
  token_count int,
  created_at timestamptz not null default now(),
  unique (material_id, chunk_index)
);

create table if not exists public.study_questions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users(id) on delete set null,
  title text not null,
  body text,
  course_code text,
  level text,
  solved boolean not null default false,
  answers_count int not null default 0,
  upvotes_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.study_questions(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  body text not null,
  is_accepted boolean not null default false,
  upvotes_count int not null default 0,
  ai_generated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_question_votes (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.study_questions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (question_id, user_id)
);

create table if not exists public.study_answer_votes (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.study_answers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (answer_id, user_id)
);

create table if not exists public.study_quiz_sets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  course_code text,
  level text,
  semester text,
  time_limit_minutes int,
  questions_count int not null default 0,
  published boolean not null default false,
  source text,
  source_material_id uuid references public.study_materials(id) on delete set null,
  intro_pick boolean not null default false,
  srs_enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_quiz_questions (
  id uuid primary key default gen_random_uuid(),
  set_id uuid references public.study_quiz_sets(id) on delete cascade,
  quiz_set_id uuid references public.study_quiz_sets(id) on delete cascade,
  prompt text not null,
  explanation text,
  ai_explanation text,
  position int,
  question_kind text,
  difficulty_level text,
  cognitive_level text,
  source_topic text,
  source_material_id uuid references public.study_materials(id) on delete set null,
  source_chunk_id uuid references public.study_material_chunks(id) on delete set null,
  question_fingerprint text,
  study_ref jsonb,
  generation_meta jsonb,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.study_quiz_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.study_quiz_questions(id) on delete cascade,
  text text not null,
  is_correct boolean not null default false,
  position int,
  created_at timestamptz not null default now()
);

create table if not exists public.study_practice_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  set_id uuid references public.study_quiz_sets(id) on delete cascade,
  status text not null default 'in_progress',
  score int,
  total_questions int,
  time_spent_seconds int,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.study_practice_attempts(id) on delete cascade,
  question_id uuid not null references public.study_quiz_questions(id) on delete cascade,
  selected_option_id uuid references public.study_quiz_options(id) on delete set null,
  is_correct boolean,
  understood boolean,
  answered_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create table if not exists public.study_weak_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.study_quiz_questions(id) on delete cascade,
  set_id uuid references public.study_quiz_sets(id) on delete cascade,
  due_at timestamptz not null default now(),
  interval_days int not null default 1,
  ease numeric not null default 2.5,
  lapses int not null default 0,
  last_seen_at timestamptz not null default now(),
  unique (user_id, question_id)
);

create table if not exists public.study_daily_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  attempts_count int not null default 0,
  questions_answered int not null default 0,
  correct_answers int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, activity_date)
);

create table if not exists public.study_saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null,
  material_id uuid references public.study_materials(id) on delete cascade,
  question_id uuid references public.study_questions(id) on delete cascade,
  quiz_set_id uuid references public.study_quiz_sets(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists study_saved_material_unique on public.study_saved_items(user_id, material_id) where material_id is not null;
create unique index if not exists study_saved_question_unique on public.study_saved_items(user_id, question_id) where question_id is not null;
create unique index if not exists study_saved_quiz_unique on public.study_saved_items(user_id, quiz_set_id) where quiz_set_id is not null;

create table if not exists public.study_tutors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text,
  bio text,
  course_codes text[],
  level text,
  department text,
  faculty text,
  phone text,
  whatsapp text,
  rate text,
  verified boolean not null default false,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  material_id uuid references public.study_materials(id) on delete set null,
  tutor_id uuid references public.study_tutors(id) on delete set null,
  question_id uuid references public.study_questions(id) on delete set null,
  answer_id uuid references public.study_answers(id) on delete set null,
  reason text,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.study_reps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'course_rep',
  faculty_id uuid references public.study_faculties(id) on delete set null,
  department_id uuid references public.study_departments(id) on delete set null,
  levels int[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, department_id)
);

create table if not exists public.study_rep_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  faculty_id uuid references public.study_faculties(id) on delete set null,
  department_id uuid references public.study_departments(id) on delete set null,
  levels int[] not null default '{}',
  role text not null default 'course_rep',
  reason text,
  status text not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.study_course_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  faculty_id uuid references public.study_faculties(id) on delete set null,
  department_id uuid references public.study_departments(id) on delete set null,
  level int,
  semester text,
  course_code text,
  course_title text,
  status text not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.study_course_setup_status (
  id uuid primary key default gen_random_uuid(),
  faculty_id uuid references public.study_faculties(id) on delete set null,
  department_id uuid references public.study_departments(id) on delete cascade,
  level int not null,
  semester text not null,
  status text not null default 'in_progress',
  created_by uuid references auth.users(id) on delete set null,
  completed_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, level, semester)
);

create table if not exists public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  plan text,
  progress jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_gpa_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.study_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  session_id text,
  event_name text not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.study_user_badge_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dismissed jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.study_question_bank_runs (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.study_courses(id) on delete cascade,
  quiz_set_id uuid references public.study_quiz_sets(id) on delete cascade,
  status text not null default 'pending',
  generated_count int not null default 0,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_question_bank_materials (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.study_question_bank_runs(id) on delete cascade,
  material_id uuid not null references public.study_materials(id) on delete cascade,
  position int not null default 0,
  status text not null default 'pending',
  topic_outline jsonb,
  generated_count int not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  unique (run_id, material_id)
);

create table if not exists public.ai_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  last_called_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, endpoint)
);

create or replace view public.study_leaderboard_v as
select
  user_id,
  sum(coalesce(correct_answers, 0))::int as points,
  sum(coalesce(questions_answered, 0))::int as questions_answered,
  count(*)::int as active_days,
  max(activity_date) as last_activity_date
from public.study_daily_activity
group by user_id;

create or replace view public.study_leaderboard_weekly_v as
select
  user_id,
  sum(coalesce(correct_answers, 0))::int as points,
  sum(coalesce(questions_answered, 0))::int as questions_answered,
  count(*)::int as active_days,
  max(activity_date) as last_activity_date
from public.study_daily_activity
where activity_date >= (current_date - interval '7 days')
group by user_id;

create or replace function public.increment_material_downloads(p_id uuid)
returns void language sql security definer as $$
  update public.study_materials
  set downloads = coalesce(downloads, 0) + 1,
      updated_at = now()
  where id = p_id;
$$;

create or replace function public.toggle_material_vote(p_material_id uuid, p_user_id uuid, p_vote int default 1)
returns int language plpgsql security definer as $$
declare
  existing_id uuid;
  total int;
begin
  select id into existing_id
  from public.study_material_ratings
  where material_id = p_material_id and user_id = p_user_id;

  if existing_id is null then
    insert into public.study_material_ratings(material_id, user_id, vote)
    values (p_material_id, p_user_id, p_vote);
  else
    delete from public.study_material_ratings where id = existing_id;
  end if;

  select count(*)::int into total
  from public.study_material_ratings
  where material_id = p_material_id;

  update public.study_materials
  set up_votes = total,
      updated_at = now()
  where id = p_material_id;

  return total;
end;
$$;

create or replace function public.increment_answers_count(q_id uuid)
returns void language sql security definer as $$
  update public.study_questions
  set answers_count = coalesce(answers_count, 0) + 1,
      updated_at = now()
  where id = q_id;
$$;

create or replace function public.get_current_semester(p_session text)
returns table (semester text, starts_on date, ends_on date)
language sql stable as $$
  select semester, starts_on, ends_on
  from public.study_academic_calendar
  where session = p_session
    and (current_date + 1) between starts_on and ends_on
  order by starts_on desc
  limit 1;
$$;

create or replace function public.get_current_semester_fallback(p_session text)
returns table (semester text, starts_on date, ends_on date)
language sql stable as $$
  select semester, starts_on, ends_on
  from public.study_academic_calendar
  where session = p_session
  order by
    case when ends_on >= (current_date + 1) then 0 else 1 end,
    abs(ends_on - (current_date + 1))
  limit 1;
$$;

create or replace function public.study_schema_health()
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'ok', true,
    'checked_at', now(),
    'tables', jsonb_build_array(
      'study_faculties',
      'study_departments',
      'study_courses',
      'study_materials',
      'study_quiz_sets',
      'study_questions'
    )
  );
$$;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'profiles','notifications','user_push_subscriptions',
    'study_faculties','study_departments','study_courses','study_preferences',
    'study_academic_calendar','study_materials','study_material_ratings','study_material_chunks',
    'study_questions','study_answers','study_question_votes','study_answer_votes',
    'study_quiz_sets','study_quiz_questions','study_quiz_options',
    'study_practice_attempts','study_attempt_answers','study_weak_questions','study_daily_activity',
    'study_saved_items','study_tutors','study_reports','study_admins','study_reps',
    'study_rep_applications','study_course_requests','study_course_setup_status',
    'study_plans','study_gpa_data','study_events','study_user_badge_state',
    'study_question_bank_runs','study_question_bank_materials','ai_rate_limits'
  ] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('grant select, insert, update, delete on public.%I to authenticated', tbl);
    execute format('grant select on public.%I to anon', tbl);
  end loop;
end $$;

drop policy if exists "profiles_own" on public.profiles;
create policy "profiles_own" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "notifications_own" on public.notifications;
create policy "notifications_own" on public.notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "push_own" on public.user_push_subscriptions;
create policy "push_own" on public.user_push_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "study_public_faculties" on public.study_faculties;
create policy "study_public_faculties" on public.study_faculties for select using (true);

drop policy if exists "study_public_departments" on public.study_departments;
create policy "study_public_departments" on public.study_departments for select using (true);

drop policy if exists "study_public_courses" on public.study_courses;
create policy "study_public_courses" on public.study_courses for select using (true);

drop policy if exists "study_preferences_own" on public.study_preferences;
create policy "study_preferences_own" on public.study_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "study_materials_read_approved_or_own" on public.study_materials;
create policy "study_materials_read_approved_or_own" on public.study_materials
for select using (approved = true or uploader_id = auth.uid());

drop policy if exists "study_materials_insert_own" on public.study_materials;
create policy "study_materials_insert_own" on public.study_materials
for insert with check (auth.uid() = uploader_id);

drop policy if exists "study_questions_read" on public.study_questions;
create policy "study_questions_read" on public.study_questions for select using (true);

drop policy if exists "study_questions_insert_own" on public.study_questions;
create policy "study_questions_insert_own" on public.study_questions for insert with check (auth.uid() = author_id);

drop policy if exists "study_answers_read" on public.study_answers;
create policy "study_answers_read" on public.study_answers for select using (true);

drop policy if exists "study_answers_insert_own" on public.study_answers;
create policy "study_answers_insert_own" on public.study_answers for insert with check (auth.uid() = author_id);

drop policy if exists "study_quiz_sets_read_published" on public.study_quiz_sets;
create policy "study_quiz_sets_read_published" on public.study_quiz_sets for select using (published = true or auth.role() = 'authenticated');

drop policy if exists "study_quiz_questions_read" on public.study_quiz_questions;
create policy "study_quiz_questions_read" on public.study_quiz_questions for select using (true);

drop policy if exists "study_quiz_options_read" on public.study_quiz_options;
create policy "study_quiz_options_read" on public.study_quiz_options for select using (true);

drop policy if exists "study_saved_own" on public.study_saved_items;
create policy "study_saved_own" on public.study_saved_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "study_attempts_own" on public.study_practice_attempts;
create policy "study_attempts_own" on public.study_practice_attempts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "study_daily_own" on public.study_daily_activity;
create policy "study_daily_own" on public.study_daily_activity for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "study_weak_own" on public.study_weak_questions;
create policy "study_weak_own" on public.study_weak_questions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "study_tutors_read" on public.study_tutors;
create policy "study_tutors_read" on public.study_tutors for select using (true);

drop policy if exists "study_tutors_own" on public.study_tutors;
create policy "study_tutors_own" on public.study_tutors for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "study_events_insert_own" on public.study_events;
create policy "study_events_insert_own" on public.study_events for insert with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('study-materials', 'study-materials', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "study_materials_storage_read" on storage.objects;
create policy "study_materials_storage_read" on storage.objects
for select using (bucket_id = 'study-materials' and auth.role() = 'authenticated');

drop policy if exists "study_materials_storage_upload" on storage.objects;
create policy "study_materials_storage_upload" on storage.objects
for insert with check (bucket_id = 'study-materials' and auth.role() = 'authenticated');

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_study_courses_updated_at on public.study_courses;
create trigger set_study_courses_updated_at before update on public.study_courses
for each row execute function public.set_updated_at();

drop trigger if exists set_study_materials_updated_at on public.study_materials;
create trigger set_study_materials_updated_at before update on public.study_materials
for each row execute function public.set_updated_at();

