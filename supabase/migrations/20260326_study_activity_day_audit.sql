-- M-4: The study_daily_activity table has both activity_date and day columns.
-- activity_date is canonical. This migration syncs day -> activity_date for
-- any rows where they diverge, then drops the day column.

UPDATE public.study_daily_activity
SET activity_date = day
WHERE day IS NOT NULL AND activity_date IS NULL;

ALTER TABLE public.study_daily_activity DROP COLUMN IF EXISTS day;
