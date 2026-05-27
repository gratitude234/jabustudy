-- Add 'master' to draft_status CHECK constraint for AI master practice sets
ALTER TABLE study_quiz_sets
  DROP CONSTRAINT IF EXISTS study_quiz_sets_draft_status_check;

ALTER TABLE study_quiz_sets
  ADD CONSTRAINT study_quiz_sets_draft_status_check
  CHECK (draft_status IN ('draft', 'kept', 'discarded', 'master'));
