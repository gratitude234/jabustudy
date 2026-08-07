-- Give each account one 10-question diagnostic per WAT day instead of one
-- diagnostic for the entire Exam Sprint campaign. No new table is required;
-- started_at remains the source of truth for the allowance.

drop index if exists public.study_exam_one_diagnostic_per_campaign_idx;
drop index if exists public.study_exam_one_diagnostic_per_wat_day_idx;

create unique index study_exam_one_diagnostic_per_wat_day_idx
  on public.study_practice_attempts (
    user_id,
    campaign_key,
    ((started_at at time zone 'Africa/Lagos')::date)
  )
  where experience = 'exam_diagnostic';
