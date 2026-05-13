ALTER TABLE public.study_quiz_questions
  ADD COLUMN IF NOT EXISTS study_ref jsonb;

COMMENT ON COLUMN public.study_quiz_questions.study_ref IS
  'Optional AI-generated source guidance for practice hints: topic, instruction, quote, and page.';
