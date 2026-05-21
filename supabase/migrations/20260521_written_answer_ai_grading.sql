-- AI-assisted grading for written practice answers.

ALTER TABLE public.study_attempt_answers
  ADD COLUMN IF NOT EXISTS ai_grade_score numeric(4,1),
  ADD COLUMN IF NOT EXISTS ai_grade_max_score integer,
  ADD COLUMN IF NOT EXISTS ai_grade_verdict text,
  ADD COLUMN IF NOT EXISTS ai_grade_feedback text,
  ADD COLUMN IF NOT EXISTS ai_grade_matched_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_grade_missing_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_grade_improved_answer text,
  ADD COLUMN IF NOT EXISTS ai_grade_provider text,
  ADD COLUMN IF NOT EXISTS ai_grade_model text,
  ADD COLUMN IF NOT EXISTS ai_grade_answer_hash text,
  ADD COLUMN IF NOT EXISTS ai_graded_at timestamptz;

CREATE INDEX IF NOT EXISTS study_attempt_answers_ai_grade_hash_idx
  ON public.study_attempt_answers (ai_grade_answer_hash);

COMMENT ON COLUMN public.study_attempt_answers.ai_grade_score IS
  'AI-assisted written-answer score. Feedback only; does not affect official practice score.';

COMMENT ON COLUMN public.study_attempt_answers.ai_grade_answer_hash IS
  'Hash of the normalized written answer that was graded, used to avoid showing stale feedback.';
