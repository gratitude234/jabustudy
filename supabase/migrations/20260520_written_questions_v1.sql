-- Written Questions V1: mixed MCQ, short-answer, and theory practice.

ALTER TABLE public.study_quiz_questions
  ADD COLUMN IF NOT EXISTS question_type text NOT NULL DEFAULT 'mcq',
  ADD COLUMN IF NOT EXISTS model_answer text,
  ADD COLUMN IF NOT EXISTS marking_points jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.study_quiz_questions
  DROP CONSTRAINT IF EXISTS study_quiz_questions_question_type_check;

ALTER TABLE public.study_quiz_questions
  ADD CONSTRAINT study_quiz_questions_question_type_check
  CHECK (question_type IN ('mcq', 'short_answer', 'theory'));

CREATE INDEX IF NOT EXISTS study_quiz_questions_question_type_idx
  ON public.study_quiz_questions (question_type);

ALTER TABLE public.study_attempt_answers
  ADD COLUMN IF NOT EXISTS text_answer text;

ALTER TABLE public.study_practice_attempts
  ADD COLUMN IF NOT EXISTS scored_questions_count integer,
  ADD COLUMN IF NOT EXISTS written_questions_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS written_answered_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.study_quiz_questions.question_type IS
  'Practice question type: mcq, short_answer, or theory.';

COMMENT ON COLUMN public.study_quiz_questions.model_answer IS
  'Reference answer shown to students after written-answer submission.';

COMMENT ON COLUMN public.study_quiz_questions.marking_points IS
  'JSON array of expected points for short-answer/theory self-review.';
