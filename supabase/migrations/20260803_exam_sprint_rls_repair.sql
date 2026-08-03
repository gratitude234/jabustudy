-- Exam Sprint RLS repair.
--
-- Fixes two things:
--   1. Super admins / reps could not open a private exam bank in the editor
--      ("Set not found") because study_quiz_sets hides private rows from the
--      browser client and 20260802_exam_sprint.sql added a moderator UPDATE
--      policy but never a matching SELECT policy.
--   2. The restrictive exam guards from 20260802_exam_sprint.sql are inert,
--      so the anon key can read paid exam questions and their correct answers.
--      Verified: anon SELECT on study_quiz_options for a private mock_exam bank
--      returned text + is_correct.
--
-- Part 2 only installs baseline policies when RLS is currently OFF for a table.
-- If RLS is already on, existing policies are left untouched and only the
-- restrictive exam guards are (re)applied.

begin;

-- ---------------------------------------------------------------------------
-- 1. Moderators can read the exam banks they are allowed to edit.
-- ---------------------------------------------------------------------------

drop policy if exists "study_quiz_sets_exam_moderator_select" on public.study_quiz_sets;
create policy "study_quiz_sets_exam_moderator_select"
on public.study_quiz_sets for select
using (
  delivery_mode = 'mock_exam'
  and (
    exists (select 1 from public.study_admins a where a.user_id = auth.uid())
    or exists (select 1 from public.study_reps r where r.user_id = auth.uid() and r.active is not false)
  )
);

-- ---------------------------------------------------------------------------
-- 2. Baseline policies for study_quiz_questions / study_quiz_options.
--    Only installed if the table currently has RLS disabled, i.e. we are the
--    first ruleset and must not narrow what already works today.
--    Reads stay wide open (exactly today's behaviour); the restrictive guard in
--    part 3 is what removes exam content from that. Writes are narrowed to the
--    people who legitimately use the set editor.
-- ---------------------------------------------------------------------------

do $repair$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.study_quiz_questions'::regclass) then
    execute $p$
      create policy "study_quiz_questions_baseline_read"
      on public.study_quiz_questions for select
      using (true)
    $p$;
    execute $p$
      create policy "study_quiz_questions_baseline_write"
      on public.study_quiz_questions for all
      using (
        exists (
          select 1 from public.study_quiz_sets s
           where s.id = coalesce(study_quiz_questions.set_id, study_quiz_questions.quiz_set_id)
             and s.created_by = auth.uid()
        )
        or exists (select 1 from public.study_admins a where a.user_id = auth.uid())
        or exists (select 1 from public.study_reps r where r.user_id = auth.uid() and r.active is not false)
      )
      with check (
        exists (
          select 1 from public.study_quiz_sets s
           where s.id = coalesce(study_quiz_questions.set_id, study_quiz_questions.quiz_set_id)
             and s.created_by = auth.uid()
        )
        or exists (select 1 from public.study_admins a where a.user_id = auth.uid())
        or exists (select 1 from public.study_reps r where r.user_id = auth.uid() and r.active is not false)
      )
    $p$;
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.study_quiz_options'::regclass) then
    execute $p$
      create policy "study_quiz_options_baseline_read"
      on public.study_quiz_options for select
      using (true)
    $p$;
    execute $p$
      create policy "study_quiz_options_baseline_write"
      on public.study_quiz_options for all
      using (
        exists (
          select 1
            from public.study_quiz_questions q
            join public.study_quiz_sets s on s.id = coalesce(q.set_id, q.quiz_set_id)
           where q.id = study_quiz_options.question_id
             and s.created_by = auth.uid()
        )
        or exists (select 1 from public.study_admins a where a.user_id = auth.uid())
        or exists (select 1 from public.study_reps r where r.user_id = auth.uid() and r.active is not false)
      )
      with check (
        exists (
          select 1
            from public.study_quiz_questions q
            join public.study_quiz_sets s on s.id = coalesce(q.set_id, q.quiz_set_id)
           where q.id = study_quiz_options.question_id
             and s.created_by = auth.uid()
        )
        or exists (select 1 from public.study_admins a where a.user_id = auth.uid())
        or exists (select 1 from public.study_reps r where r.user_id = auth.uid() and r.active is not false)
      )
    $p$;
  end if;
end
$repair$;

alter table public.study_quiz_questions enable row level security;
alter table public.study_quiz_options enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Restrictive exam guards. Restrictive policies are ANDed with everything
--    else, so no permissive policy above (or any older one) can expose exam
--    content. Widened from SELECT to ALL so writes are covered too.
--    Service-role routes bypass RLS entirely and are unaffected.
--
--    Note: this grants every active rep read access to paid exam content, which
--    is what 20260802_exam_sprint.sql chose. To restrict to super admins only,
--    delete the study_reps clause from both policies below.
-- ---------------------------------------------------------------------------

drop policy if exists "study_quiz_questions_hide_exam" on public.study_quiz_questions;
create policy "study_quiz_questions_hide_exam"
on public.study_quiz_questions as restrictive for all
using (
  not exists (
    select 1
      from public.study_quiz_sets s
     where s.id = coalesce(study_quiz_questions.set_id, study_quiz_questions.quiz_set_id)
       and s.delivery_mode = 'mock_exam'
  )
  or exists (select 1 from public.study_admins a where a.user_id = auth.uid())
  or exists (select 1 from public.study_reps r where r.user_id = auth.uid() and r.active is not false)
)
with check (
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
on public.study_quiz_options as restrictive for all
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
)
with check (
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

commit;
