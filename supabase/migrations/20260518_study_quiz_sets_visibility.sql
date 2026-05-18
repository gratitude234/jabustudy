ALTER TABLE public.study_quiz_sets
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';

ALTER TABLE public.study_quiz_sets
  DROP CONSTRAINT IF EXISTS study_quiz_sets_visibility_check;

ALTER TABLE public.study_quiz_sets
  ADD CONSTRAINT study_quiz_sets_visibility_check
  CHECK (visibility IN ('public', 'private', 'pending_review'));

CREATE INDEX IF NOT EXISTS study_quiz_sets_visibility_created_idx
  ON public.study_quiz_sets (visibility, created_at DESC);

CREATE INDEX IF NOT EXISTS study_quiz_sets_created_by_visibility_idx
  ON public.study_quiz_sets (created_by, visibility, created_at DESC);
