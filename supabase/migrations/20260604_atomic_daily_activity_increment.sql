-- Replaces the read-then-write pattern in the practice submit route with a single
-- atomic INSERT ... ON CONFLICT DO UPDATE that increments all counters in one statement,
-- eliminating the race condition where two concurrent submits both read stale values.

create or replace function public.increment_study_daily_activity(
  p_user_id uuid,
  p_activity_date text,
  p_questions_answered integer,
  p_correct_answers integer,
  p_updated_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.study_daily_activity (
    user_id,
    activity_date,
    attempts_count,
    questions_answered,
    correct_answers,
    updated_at
  )
  values (
    p_user_id,
    p_activity_date::date,
    1,
    p_questions_answered,
    p_correct_answers,
    p_updated_at
  )
  on conflict (user_id, activity_date)
  do update set
    attempts_count     = study_daily_activity.attempts_count + 1,
    questions_answered = study_daily_activity.questions_answered + excluded.questions_answered,
    correct_answers    = study_daily_activity.correct_answers + excluded.correct_answers,
    updated_at         = excluded.updated_at;
end;
$$;

revoke all on function public.increment_study_daily_activity(uuid, text, integer, integer, timestamptz) from public;
grant execute on function public.increment_study_daily_activity(uuid, text, integer, integer, timestamptz) to service_role;
