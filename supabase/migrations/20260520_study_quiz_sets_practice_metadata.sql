-- Align practice set metadata used by the Study Hub practice UI/editor.

ALTER TABLE public.study_quiz_sets
  ADD COLUMN IF NOT EXISTS semester text,
  ADD COLUMN IF NOT EXISTS time_limit_minutes integer,
  ADD COLUMN IF NOT EXISTS difficulty text,
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS questions_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.study_quiz_sets
  DROP CONSTRAINT IF EXISTS study_quiz_sets_difficulty_check;

ALTER TABLE public.study_quiz_sets
  ADD CONSTRAINT study_quiz_sets_difficulty_check
  CHECK (difficulty IS NULL OR difficulty IN ('easy', 'medium', 'hard'));

CREATE INDEX IF NOT EXISTS study_quiz_sets_published_created_idx
  ON public.study_quiz_sets (published, created_at DESC);

CREATE INDEX IF NOT EXISTS study_quiz_sets_course_level_semester_idx
  ON public.study_quiz_sets (course_code, level, semester);
