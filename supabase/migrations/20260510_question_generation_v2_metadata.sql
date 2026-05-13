-- Question Generation V2 metadata for coverage-aware AI questions.

ALTER TABLE public.study_quiz_questions
  ADD COLUMN IF NOT EXISTS question_kind text,
  ADD COLUMN IF NOT EXISTS difficulty_level text,
  ADD COLUMN IF NOT EXISTS cognitive_level text,
  ADD COLUMN IF NOT EXISTS source_topic text,
  ADD COLUMN IF NOT EXISTS question_fingerprint text,
  ADD COLUMN IF NOT EXISTS generation_meta jsonb;

CREATE INDEX IF NOT EXISTS study_quiz_questions_fingerprint_idx
  ON public.study_quiz_questions(question_fingerprint);

CREATE INDEX IF NOT EXISTS study_quiz_questions_source_topic_idx
  ON public.study_quiz_questions(source_material_id, source_topic);

COMMENT ON COLUMN public.study_quiz_questions.question_kind IS
  'AI question style such as recall, application, comparison, exception, or clinical.';

COMMENT ON COLUMN public.study_quiz_questions.cognitive_level IS
  'Bloom-style level used by the AI generator: recall, understanding, application, or analysis.';

COMMENT ON COLUMN public.study_quiz_questions.question_fingerprint IS
  'Normalized fingerprint used to reject repeated or near-repeated AI questions.';

COMMENT ON COLUMN public.study_quiz_questions.generation_meta IS
  'Structured metadata from the coverage-aware AI generation pipeline.';
