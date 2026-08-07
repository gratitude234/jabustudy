-- Make Exam Sprint forgiving when a student starts the wrong course without
-- weakening the one-live-timer rule.
--
-- `mistake` is a zero-impact cancellation granted by the application only when
-- the attempt is untouched, inside the short grace window, and the account has
-- not already used its WAT-day mistake cancellation.
-- `switched` is an intentional early end after that point. It never creates a
-- 0% score, but a switched full mock consumes one of the weekly leaderboard's
-- first three attempt slots.

alter table public.study_practice_attempts
  drop constraint if exists study_practice_attempts_submission_reason_check;

alter table public.study_practice_attempts
  add constraint study_practice_attempts_submission_reason_check
    check (
      submission_reason is null
      or submission_reason in ('manual', 'timeup', 'mistake', 'switched')
    );

-- A grace-cancelled diagnostic is treated as if it never consumed the daily
-- free check. Any submitted or ended-early diagnostic still consumes the day.
drop index if exists public.study_exam_one_diagnostic_per_wat_day_idx;

create unique index study_exam_one_diagnostic_per_wat_day_idx
  on public.study_practice_attempts (
    user_id,
    campaign_key,
    ((started_at at time zone 'Africa/Lagos')::date)
  )
  where experience = 'exam_diagnostic' and status <> 'cancelled';

create index if not exists study_exam_mistake_grace_lookup_idx
  on public.study_practice_attempts (user_id, campaign_key, started_at desc)
  where submission_reason = 'mistake';

-- Weekly fairness now counts an ended-early full mock as a slot. Genuine
-- grace cancellations are status=cancelled and therefore never enter the board.
drop index if exists public.study_exam_weekly_leaderboard_idx;

create index study_exam_weekly_leaderboard_idx
  on public.study_practice_attempts (campaign_key, set_id, started_at, user_id)
  where experience = 'exam_mock' and status in ('submitted', 'abandoned');

create or replace function public.get_exam_sprint_weekly_leaderboard(
  p_campaign_key text,
  p_set_ids uuid[],
  p_week_start timestamptz,
  p_week_end timestamptz,
  p_user_id uuid default null,
  p_attempt_limit integer default 3,
  p_question_count integer default 40
)
returns table (
  user_id uuid,
  position bigint,
  best_percentage integer,
  coverage bigint,
  qualifying_attempts bigint,
  participant_count bigint
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with candidate_slots as (
    select
      a.id,
      a.user_id,
      a.started_at,
      a.status,
      a.score,
      a.total_questions,
      a.delivery_snapshot,
      row_number() over (
        partition by a.user_id
        order by a.started_at asc, a.id asc
      ) as slot_number
    from public.study_practice_attempts a
    where a.campaign_key = p_campaign_key
      and a.set_id = any (p_set_ids)
      and a.experience = 'exam_mock'
      and a.status in ('submitted', 'abandoned')
      and a.started_at >= p_week_start
      and a.started_at < p_week_end
      and a.total_questions = greatest(1, p_question_count)
  ),
  first_slots as (
    select c.*
    from candidate_slots c
    where c.slot_number <= greatest(1, least(coalesce(p_attempt_limit, 3), 10))
  ),
  scored_attempts as (
    select s.*
    from first_slots s
    where s.status = 'submitted'
      and s.score is not null
  ),
  user_slot_counts as (
    select
      s.user_id,
      count(*)::bigint as qualifying_attempts
    from first_slots s
    group by s.user_id
  ),
  user_scores as (
    select
      s.user_id,
      max(round((s.score::numeric * 100) / nullif(s.total_questions, 0))::integer) as best_percentage
    from scored_attempts s
    group by s.user_id
  ),
  user_coverage as (
    select
      s.user_id,
      count(distinct question.value ->> 'id')::bigint as coverage
    from scored_attempts s
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(s.delivery_snapshot -> 'questions') = 'array'
          then s.delivery_snapshot -> 'questions'
        else '[]'::jsonb
      end
    ) as question(value)
    where nullif(question.value ->> 'id', '') is not null
    group by s.user_id
  ),
  user_metrics as (
    select
      scores.user_id,
      scores.best_percentage,
      coalesce(coverage.coverage, 0)::bigint as coverage,
      slots.qualifying_attempts
    from user_scores scores
    join user_slot_counts slots on slots.user_id = scores.user_id
    left join user_coverage coverage on coverage.user_id = scores.user_id
  ),
  ranked_users as (
    select
      metrics.user_id,
      rank() over (
        order by metrics.best_percentage desc, metrics.coverage desc
      ) as position,
      metrics.best_percentage,
      metrics.coverage,
      metrics.qualifying_attempts
    from user_metrics metrics
  ),
  ranked_with_total as (
    select
      ranked.*,
      count(*) over ()::bigint as participant_count
    from ranked_users ranked
  )
  select
    ranked.user_id,
    ranked.position,
    ranked.best_percentage,
    ranked.coverage,
    ranked.qualifying_attempts,
    ranked.participant_count
  from ranked_with_total ranked
  where ranked.position <= 10
     or (p_user_id is not null and ranked.user_id = p_user_id)
  order by ranked.position asc, ranked.user_id asc;
$$;

revoke all on function public.get_exam_sprint_weekly_leaderboard(
  text, uuid[], timestamptz, timestamptz, uuid, integer, integer
) from public, anon, authenticated;

grant execute on function public.get_exam_sprint_weekly_leaderboard(
  text, uuid[], timestamptz, timestamptz, uuid, integer, integer
) to service_role;
