-- Practice answer confidence: lets the SRS keep guessed/unsure answers in review.

ALTER TABLE public.study_attempt_answers
  ADD COLUMN IF NOT EXISTS confidence text;

ALTER TABLE public.study_attempt_answers
  DROP CONSTRAINT IF EXISTS study_attempt_answers_confidence_check;

ALTER TABLE public.study_attempt_answers
  ADD CONSTRAINT study_attempt_answers_confidence_check
  CHECK (confidence IS NULL OR confidence IN ('confident', 'unsure', 'guessed'));

COMMENT ON COLUMN public.study_attempt_answers.confidence IS
  'Student self-rating for an answer: confident, unsure, or guessed.';
