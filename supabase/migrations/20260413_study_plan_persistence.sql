ALTER TABLE public.study_preferences
  ADD COLUMN IF NOT EXISTS last_study_plan text,
  ADD COLUMN IF NOT EXISTS last_study_plan_at timestamptz;
