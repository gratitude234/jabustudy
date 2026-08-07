-- Replace the calendar-day diagnostic allowance with a rolling five-hour
-- cooldown. The application enforces the exact rolling boundary using the
-- latest non-cancelled diagnostic started_at timestamp.
--
-- The previous WAT-day unique index must be removed or it would incorrectly
-- block a second valid diagnostic later on the same day. Direct student writes
-- remain blocked by the existing Exam Sprint RLS/server-only attempt flow, and
-- the one-live-timer index still protects concurrent starts.

drop index if exists public.study_exam_one_diagnostic_per_wat_day_idx;

create index if not exists study_exam_diagnostic_cooldown_lookup_idx
  on public.study_practice_attempts (user_id, campaign_key, started_at desc)
  where experience = 'exam_diagnostic' and status <> 'cancelled';
