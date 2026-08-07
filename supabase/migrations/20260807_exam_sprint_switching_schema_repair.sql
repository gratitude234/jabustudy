-- Repair Exam Sprint course switching for databases where the earlier
-- switching/leaderboard migration did not complete. This migration is safe to
-- run after the five-hour diagnostic migration and deliberately does not
-- recreate the old one-diagnostic-per-WAT-day unique index.

alter table public.study_practice_attempts
  drop constraint if exists study_practice_attempts_submission_reason_check;

alter table public.study_practice_attempts
  add constraint study_practice_attempts_submission_reason_check
    check (
      submission_reason is null
      or submission_reason in ('manual', 'timeup', 'mistake', 'switched')
    );

create index if not exists study_exam_mistake_grace_lookup_idx
  on public.study_practice_attempts (user_id, campaign_key, started_at desc)
  where submission_reason = 'mistake';

-- An ended-early mock uses one of the student's first three leaderboard slots,
-- but only submitted mocks contribute a score.
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
    select candidate.*
    from candidate_slots candidate
    where candidate.slot_number <= greatest(1, least(coalesce(p_attempt_limit, 3), 10))
  ),
  scored_attempts as (
    select slot.*
    from first_slots slot
    where slot.status = 'submitted'
      and slot.score is not null
  ),
  user_slot_counts as (
    select
      slot.user_id,
      count(*)::bigint as qualifying_attempts
    from first_slots slot
    group by slot.user_id
  ),
  user_scores as (
    select
      scored.user_id,
      max(round((scored.score::numeric * 100) / nullif(scored.total_questions, 0))::integer) as best_percentage
    from scored_attempts scored
    group by scored.user_id
  ),
  user_coverage as (
    select
      scored.user_id,
      count(distinct question.value ->> 'id')::bigint as coverage
    from scored_attempts scored
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(scored.delivery_snapshot -> 'questions') = 'array'
          then scored.delivery_snapshot -> 'questions'
        else '[]'::jsonb
      end
    ) as question(value)
    where nullif(question.value ->> 'id', '') is not null
    group by scored.user_id
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
