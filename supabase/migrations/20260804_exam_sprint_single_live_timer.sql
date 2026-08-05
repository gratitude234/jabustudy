-- A timed CBT cannot be meaningfully taken alongside another running timer.
-- Preserve the most urgent attempt for each learner/campaign, safely score any
-- anomalous extras, then enforce one live mock at the database boundary.
do $$
declare
  duplicate_attempt record;
begin
  for duplicate_attempt in
    select id, user_id
    from (
      select
        id,
        user_id,
        row_number() over (
          partition by user_id, campaign_key
          order by deadline_at asc, started_at asc, id asc
        ) as priority
      from public.study_practice_attempts
      where experience in ('exam_diagnostic', 'exam_mock')
        and status = 'in_progress'
    ) ranked
    where ranked.priority > 1
  loop
    perform public.submit_exam_attempt(
      duplicate_attempt.id,
      duplicate_attempt.user_id,
      'manual'
    );
  end loop;
end;
$$;

drop index if exists public.study_exam_one_active_mock_idx;
drop index if exists public.study_exam_one_active_mock_per_campaign_idx;

create unique index if not exists study_exam_one_active_timed_attempt_per_campaign_idx
  on public.study_practice_attempts (user_id, campaign_key)
  where experience in ('exam_diagnostic', 'exam_mock') and status = 'in_progress';
