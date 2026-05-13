-- Add "understood" flag to practice attempt answers.
-- Allows students to mark questions they've reviewed and understood.
ALTER TABLE public.study_attempt_answers
  ADD COLUMN IF NOT EXISTS understood BOOLEAN NOT NULL DEFAULT FALSE;
