-- Lightweight weekly Exam Sprint leaderboard.
--
-- Only submitted, full 40-question Exam Sprint mocks are eligible. A student's
-- best score from their first three eligible submissions in the WAT week counts.
-- Ties are resolved by broader unique question coverage; completion speed is
-- intentionally not part of the ranking.

create index if not exists study_exam_weekly_leaderboard_idx
  on public.study_practice_attempts (campaign_key, set_id, submitted_at, user_id)
  where experience = 'exam_mock' and status = 'submitted';

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
  "position" bigint,
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
  with candidate_attempts as (
    select
      a.id,
      a.user_id,
      a.submitted_at,
      a.score,
      a.total_questions,
      a.delivery_snapshot,
      row_number() over (
        partition by a.user_id
        order by a.submitted_at asc, a.id asc
      ) as attempt_number
    from public.study_practice_attempts a
    where a.campaign_key = p_campaign_key
      and a.set_id = any (p_set_ids)
      and a.experience = 'exam_mock'
      and a.status = 'submitted'
      and a.submitted_at >= p_week_start
      and a.submitted_at < p_week_end
      and a.score is not null
      and a.total_questions = greatest(1, p_question_count)
  ),
  qualifying_attempts as (
    select c.*
    from candidate_attempts c
    where c.attempt_number <= greatest(1, least(coalesce(p_attempt_limit, 3), 10))
  ),
  user_scores as (
    select
      q.user_id,
      max(round((q.score::numeric * 100) / nullif(q.total_questions, 0))::integer) as best_percentage,
      count(*)::bigint as qualifying_attempts
    from qualifying_attempts q
    group by q.user_id
  ),
  user_coverage as (
    select
      q.user_id,
      count(distinct question.value ->> 'id')::bigint as coverage
    from qualifying_attempts q
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(q.delivery_snapshot -> 'questions') = 'array'
          then q.delivery_snapshot -> 'questions'
        else '[]'::jsonb
      end
    ) as question(value)
    where nullif(question.value ->> 'id', '') is not null
    group by q.user_id
  ),
  user_metrics as (
    select
      scores.user_id,
      scores.best_percentage,
      coalesce(coverage.coverage, 0)::bigint as coverage,
      scores.qualifying_attempts
    from user_scores scores
    left join user_coverage coverage on coverage.user_id = scores.user_id
  ),
  ranked_users as (
    select
      metrics.user_id,
      rank() over (
        order by metrics.best_percentage desc, metrics.coverage desc
      ) as leaderboard_position,
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
    ranked.leaderboard_position as "position",
    ranked.best_percentage,
    ranked.coverage,
    ranked.qualifying_attempts,
    ranked.participant_count
  from ranked_with_total ranked
  where ranked.leaderboard_position <= 10
     or (p_user_id is not null and ranked.user_id = p_user_id)
  order by ranked.leaderboard_position asc, ranked.user_id asc;
$$;

revoke all on function public.get_exam_sprint_weekly_leaderboard(
  text, uuid[], timestamptz, timestamptz, uuid, integer, integer
) from public, anon, authenticated;

grant execute on function public.get_exam_sprint_weekly_leaderboard(
  text, uuid[], timestamptz, timestamptz, uuid, integer, integer
) to service_role;
