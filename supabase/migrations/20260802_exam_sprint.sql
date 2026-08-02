-- Exam Sprint 2026: secure mock-exam delivery on top of the existing practice schema.

alter table public.study_quiz_sets
  add column if not exists delivery_mode text not null default 'practice',
  add column if not exists exam_campaign_key text,
  add column if not exists access_tier text not null default 'free',
  add column if not exists exam_question_count integer not null default 40,
  add column if not exists diagnostic_question_count integer not null default 10,
  add column if not exists diagnostic_time_limit_minutes integer not null default 10,
  add column if not exists exam_published_by uuid references auth.users(id) on delete set null,
  add column if not exists exam_published_at timestamptz;

alter table public.study_quiz_sets
  drop constraint if exists study_quiz_sets_delivery_mode_check,
  drop constraint if exists study_quiz_sets_access_tier_check,
  drop constraint if exists study_quiz_sets_exam_question_count_check,
  drop constraint if exists study_quiz_sets_diagnostic_question_count_check,
  drop constraint if exists study_quiz_sets_diagnostic_time_limit_check;

alter table public.study_quiz_sets
  add constraint study_quiz_sets_delivery_mode_check
    check (delivery_mode in ('practice', 'mock_exam')),
  add constraint study_quiz_sets_access_tier_check
    check (access_tier in ('free', 'plus_monthly')),
  add constraint study_quiz_sets_exam_question_count_check
    check (exam_question_count between 1 and 200),
  add constraint study_quiz_sets_diagnostic_question_count_check
    check (diagnostic_question_count between 1 and 50),
  add constraint study_quiz_sets_diagnostic_time_limit_check
    check (diagnostic_time_limit_minutes between 1 and 180);

create index if not exists study_quiz_sets_exam_campaign_idx
  on public.study_quiz_sets (exam_campaign_key, published, course_code)
  where delivery_mode = 'mock_exam';

alter table public.study_quiz_questions
  add column if not exists exam_verified_by uuid references auth.users(id) on delete set null,
  add column if not exists exam_verified_at timestamptz;

alter table public.study_practice_attempts
  add column if not exists experience text not null default 'practice',
  add column if not exists campaign_key text,
  add column if not exists deadline_at timestamptz,
  add column if not exists delivery_snapshot jsonb,
  add column if not exists submission_reason text;

alter table public.study_practice_attempts
  drop constraint if exists study_practice_attempts_experience_check,
  drop constraint if exists study_practice_attempts_submission_reason_check;

alter table public.study_practice_attempts
  add constraint study_practice_attempts_experience_check
    check (experience in ('practice', 'exam_diagnostic', 'exam_mock')),
  add constraint study_practice_attempts_submission_reason_check
    check (submission_reason is null or submission_reason in ('manual', 'timeup'));

create unique index if not exists study_exam_one_diagnostic_per_campaign_idx
  on public.study_practice_attempts (user_id, campaign_key)
  where experience = 'exam_diagnostic';

create unique index if not exists study_exam_one_active_mock_idx
  on public.study_practice_attempts (user_id, set_id)
  where experience = 'exam_mock' and status = 'in_progress';

create index if not exists study_exam_attempts_campaign_user_idx
  on public.study_practice_attempts (campaign_key, user_id, created_at desc)
  where experience in ('exam_diagnostic', 'exam_mock');

alter table public.study_attempt_answers
  add column if not exists flagged boolean not null default false;

-- Any content change invalidates the human verification mark.
create or replace function public.clear_exam_question_verification()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.prompt is distinct from old.prompt
     or new.explanation is distinct from old.explanation
     or new.question_type is distinct from old.question_type then
    new.exam_verified_by := null;
    new.exam_verified_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists clear_exam_question_verification_trigger on public.study_quiz_questions;
create trigger clear_exam_question_verification_trigger
before update of prompt, explanation, question_type on public.study_quiz_questions
for each row execute function public.clear_exam_question_verification();

create or replace function public.clear_exam_verification_from_option()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question_id uuid;
begin
  if tg_op = 'DELETE' then
    v_question_id := old.question_id;
  else
    v_question_id := new.question_id;
  end if;
  update public.study_quiz_questions
     set exam_verified_by = null,
         exam_verified_at = null
   where id = v_question_id;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists clear_exam_verification_from_option_trigger on public.study_quiz_options;
create trigger clear_exam_verification_from_option_trigger
after insert or update or delete on public.study_quiz_options
for each row execute function public.clear_exam_verification_from_option();

-- A published bank is automatically withdrawn whenever its content changes.
create or replace function public.invalidate_exam_set_from_question()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_set_id uuid;
begin
  if tg_op = 'DELETE' then
    v_set_id := coalesce(old.set_id, old.quiz_set_id);
  else
    v_set_id := coalesce(new.set_id, new.quiz_set_id);
  end if;
  update public.study_quiz_sets
     set published = false,
         visibility = 'private',
         exam_published_by = null,
         exam_published_at = null
   where id = v_set_id
     and delivery_mode = 'mock_exam'
     and published = true;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists invalidate_exam_set_from_question_trigger on public.study_quiz_questions;
create trigger invalidate_exam_set_from_question_trigger
after insert or update or delete on public.study_quiz_questions
for each row execute function public.invalidate_exam_set_from_question();

create or replace function public.invalidate_exam_set_from_option()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question_id uuid;
  v_set_id uuid;
begin
  if tg_op = 'DELETE' then v_question_id := old.question_id; else v_question_id := new.question_id; end if;
  select coalesce(q.set_id, q.quiz_set_id) into v_set_id
    from public.study_quiz_questions q
   where q.id = v_question_id;
  update public.study_quiz_sets
     set published = false,
         visibility = 'private',
         exam_published_by = null,
         exam_published_at = null
   where id = v_set_id
     and delivery_mode = 'mock_exam'
     and published = true;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists invalidate_exam_set_from_option_trigger on public.study_quiz_options;
create trigger invalidate_exam_set_from_option_trigger
after insert or update or delete on public.study_quiz_options
for each row execute function public.invalidate_exam_set_from_option();

-- Exam delivery state is controlled by service-role routes. A populated or public
-- practice set can never be re-labelled as a paid bank.
create or replace function public.guard_exam_set_security()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_privileged boolean := current_user in ('postgres', 'supabase_admin', 'service_role')
    or coalesce(auth.role(), '') = 'service_role';
begin
  if tg_op = 'INSERT' then
    if new.delivery_mode = 'mock_exam' and not v_privileged then
      raise exception 'Exam banks must be created through a privileged server route.';
    end if;
    return new;
  end if;

  if old.delivery_mode = 'practice' and new.delivery_mode = 'mock_exam'
     and (
       old.published
       or exists (
         select 1 from public.study_quiz_questions q
          where coalesce(q.set_id, q.quiz_set_id) = old.id
       )
     ) then
    raise exception 'A populated or public practice set cannot become an exam bank.';
  end if;

  if not v_privileged and (
    new.delivery_mode is distinct from old.delivery_mode
    or (old.delivery_mode = 'mock_exam' and (
      new.published is distinct from old.published
      or new.visibility is distinct from old.visibility
      or new.access_tier is distinct from old.access_tier
      or new.exam_published_by is distinct from old.exam_published_by
      or new.exam_published_at is distinct from old.exam_published_at
    ))
  ) then
    raise exception 'Exam publication state must be changed through a privileged server route.';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_exam_set_security_trigger on public.study_quiz_sets;
create trigger guard_exam_set_security_trigger
before insert or update on public.study_quiz_sets
for each row execute function public.guard_exam_set_security();

-- Lock the parent attempt while writing an exam response. This makes response
-- saves and submission serialize cleanly at the deadline.
create or replace function public.guard_exam_answer_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.study_practice_attempts%rowtype;
begin
  select * into v_attempt
    from public.study_practice_attempts
   where id = new.attempt_id
   for update;

  if found and v_attempt.experience in ('exam_diagnostic', 'exam_mock') then
    if v_attempt.status <> 'in_progress' or v_attempt.deadline_at <= clock_timestamp() then
      raise exception 'ATTEMPT_CLOSED';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_exam_answer_write_trigger on public.study_attempt_answers;
create trigger guard_exam_answer_write_trigger
before insert or update on public.study_attempt_answers
for each row execute function public.guard_exam_answer_write();

-- Atomic, idempotent scoring. The row lock pairs with the response trigger above,
-- so a last-second saved answer is either included or rejected as too late.
create or replace function public.submit_exam_attempt(
  p_attempt_id uuid,
  p_user_id uuid,
  p_reason text default 'manual'
)
returns public.study_practice_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.study_practice_attempts%rowtype;
  v_score integer := 0;
  v_total integer := 0;
  v_submitted_at timestamptz := clock_timestamp();
  v_reason text;
  v_time_spent integer;
begin
  select * into v_attempt
    from public.study_practice_attempts
   where id = p_attempt_id
     and user_id = p_user_id
     and experience in ('exam_diagnostic', 'exam_mock')
   for update;

  if not found then
    raise exception 'ATTEMPT_NOT_FOUND';
  end if;
  if v_attempt.status = 'submitted' then
    return v_attempt;
  end if;
  if v_attempt.status <> 'in_progress' then
    raise exception 'ATTEMPT_SUBMITTED';
  end if;

  select count(*)::integer,
         count(*) filter (
           where answer.selected_option_id::text = question.item->>'correctOptionId'
         )::integer
    into v_total, v_score
    from jsonb_array_elements(v_attempt.delivery_snapshot->'questions') as question(item)
    left join public.study_attempt_answers answer
      on answer.attempt_id = v_attempt.id
     and answer.question_id::text = question.item->>'id';

  v_reason := case
    when v_attempt.deadline_at <= v_submitted_at then 'timeup'
    when p_reason = 'timeup' then 'manual'
    else 'manual'
  end;
  v_time_spent := greatest(0, floor(extract(epoch from (
    least(v_submitted_at, v_attempt.deadline_at) - v_attempt.started_at
  )))::integer);

  update public.study_practice_attempts
     set status = 'submitted',
         submitted_at = v_submitted_at,
         updated_at = v_submitted_at,
         submission_reason = v_reason,
         score = v_score,
         total_questions = v_total,
         scored_questions_count = v_total,
         time_spent_seconds = v_time_spent
   where id = v_attempt.id
   returning * into v_attempt;

  return v_attempt;
end;
$$;

revoke all on function public.submit_exam_attempt(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.submit_exam_attempt(uuid, uuid, text) to service_role;

-- Mock questions and correct-option flags must never be readable directly by students.
drop policy if exists "study_quiz_questions_hide_exam" on public.study_quiz_questions;
create policy "study_quiz_questions_hide_exam"
on public.study_quiz_questions as restrictive for select
using (
  not exists (
    select 1
      from public.study_quiz_sets s
     where s.id = coalesce(study_quiz_questions.set_id, study_quiz_questions.quiz_set_id)
       and s.delivery_mode = 'mock_exam'
  )
  or exists (select 1 from public.study_admins a where a.user_id = auth.uid())
  or exists (select 1 from public.study_reps r where r.user_id = auth.uid() and r.active is not false)
);

drop policy if exists "study_quiz_options_hide_exam" on public.study_quiz_options;
create policy "study_quiz_options_hide_exam"
on public.study_quiz_options as restrictive for select
using (
  not exists (
    select 1
      from public.study_quiz_questions q
      join public.study_quiz_sets s on s.id = coalesce(q.set_id, q.quiz_set_id)
     where q.id = study_quiz_options.question_id
       and s.delivery_mode = 'mock_exam'
  )
  or exists (select 1 from public.study_admins a where a.user_id = auth.uid())
  or exists (select 1 from public.study_reps r where r.user_id = auth.uid() and r.active is not false)
);

-- Scoped moderators author private exam drafts in the existing editor.
drop policy if exists "study_quiz_sets_exam_moderator_update" on public.study_quiz_sets;
create policy "study_quiz_sets_exam_moderator_update"
on public.study_quiz_sets for update
using (
  delivery_mode = 'mock_exam'
  and (
    exists (select 1 from public.study_admins a where a.user_id = auth.uid())
    or exists (select 1 from public.study_reps r where r.user_id = auth.uid() and r.active is not false)
  )
)
with check (delivery_mode = 'mock_exam');

drop policy if exists "study_quiz_questions_exam_moderator_all" on public.study_quiz_questions;
create policy "study_quiz_questions_exam_moderator_all"
on public.study_quiz_questions for all
using (
  exists (
    select 1 from public.study_quiz_sets s
     where s.id = coalesce(study_quiz_questions.set_id, study_quiz_questions.quiz_set_id)
       and s.delivery_mode = 'mock_exam'
  )
  and (
    exists (select 1 from public.study_admins a where a.user_id = auth.uid())
    or exists (select 1 from public.study_reps r where r.user_id = auth.uid() and r.active is not false)
  )
)
with check (
  exists (
    select 1 from public.study_quiz_sets s
     where s.id = coalesce(study_quiz_questions.set_id, study_quiz_questions.quiz_set_id)
       and s.delivery_mode = 'mock_exam'
  )
);

drop policy if exists "study_quiz_options_exam_moderator_all" on public.study_quiz_options;
create policy "study_quiz_options_exam_moderator_all"
on public.study_quiz_options for all
using (
  exists (
    select 1
      from public.study_quiz_questions q
      join public.study_quiz_sets s on s.id = coalesce(q.set_id, q.quiz_set_id)
     where q.id = study_quiz_options.question_id
       and s.delivery_mode = 'mock_exam'
  )
  and (
    exists (select 1 from public.study_admins a where a.user_id = auth.uid())
    or exists (select 1 from public.study_reps r where r.user_id = auth.uid() and r.active is not false)
  )
)
with check (
  exists (
    select 1
      from public.study_quiz_questions q
      join public.study_quiz_sets s on s.id = coalesce(q.set_id, q.quiz_set_id)
     where q.id = study_quiz_options.question_id
       and s.delivery_mode = 'mock_exam'
  )
);

-- Existing permissive practice policies remain in place. Restrictive guards are
-- ANDed with them so no older policy can accidentally expose or mutate exam rows.
drop policy if exists "study_attempts_hide_exam_select" on public.study_practice_attempts;
create policy "study_attempts_hide_exam_select"
on public.study_practice_attempts as restrictive for select
using (auth.uid() = user_id and experience = 'practice');

drop policy if exists "study_attempts_hide_exam_insert" on public.study_practice_attempts;
create policy "study_attempts_hide_exam_insert"
on public.study_practice_attempts as restrictive for insert
with check (
  auth.uid() = user_id
  and experience = 'practice'
  and not exists (
    select 1 from public.study_quiz_sets s
     where s.id = study_practice_attempts.set_id
       and s.delivery_mode = 'mock_exam'
  )
);

drop policy if exists "study_attempts_hide_exam_update" on public.study_practice_attempts;
create policy "study_attempts_hide_exam_update"
on public.study_practice_attempts as restrictive for update
using (auth.uid() = user_id and experience = 'practice')
with check (auth.uid() = user_id and experience = 'practice');

drop policy if exists "study_attempts_hide_exam_delete" on public.study_practice_attempts;
create policy "study_attempts_hide_exam_delete"
on public.study_practice_attempts as restrictive for delete
using (auth.uid() = user_id and experience = 'practice');

drop policy if exists "study_attempt_answers_hide_exam_select" on public.study_attempt_answers;
create policy "study_attempt_answers_hide_exam_select"
on public.study_attempt_answers as restrictive for select
using (
  exists (
    select 1 from public.study_practice_attempts a
     where a.id = study_attempt_answers.attempt_id
       and a.user_id = auth.uid()
       and a.experience = 'practice'
  )
);

drop policy if exists "study_attempt_answers_hide_exam_insert" on public.study_attempt_answers;
create policy "study_attempt_answers_hide_exam_insert"
on public.study_attempt_answers as restrictive for insert
with check (
  exists (
    select 1 from public.study_practice_attempts a
     where a.id = study_attempt_answers.attempt_id
       and a.user_id = auth.uid()
       and a.experience = 'practice'
  )
);

drop policy if exists "study_attempt_answers_hide_exam_update" on public.study_attempt_answers;
create policy "study_attempt_answers_hide_exam_update"
on public.study_attempt_answers as restrictive for update
using (
  exists (
    select 1 from public.study_practice_attempts a
     where a.id = study_attempt_answers.attempt_id
       and a.user_id = auth.uid()
       and a.experience = 'practice'
  )
)
with check (
  exists (
    select 1 from public.study_practice_attempts a
     where a.id = study_attempt_answers.attempt_id
       and a.user_id = auth.uid()
       and a.experience = 'practice'
  )
);

drop policy if exists "study_attempt_answers_hide_exam_delete" on public.study_attempt_answers;
create policy "study_attempt_answers_hide_exam_delete"
on public.study_attempt_answers as restrictive for delete
using (
  exists (
    select 1 from public.study_practice_attempts a
     where a.id = study_attempt_answers.attempt_id
       and a.user_id = auth.uid()
       and a.experience = 'practice'
  )
);
