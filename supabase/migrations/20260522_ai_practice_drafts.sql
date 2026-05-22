-- Persistent AI practice drafts for personal generated question sets.

ALTER TABLE public.study_quiz_sets
  ADD COLUMN IF NOT EXISTS draft_status text,
  ADD COLUMN IF NOT EXISTS draft_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS generation_config jsonb DEFAULT NULL;

ALTER TABLE public.study_quiz_sets
  DROP CONSTRAINT IF EXISTS study_quiz_sets_draft_status_check;

ALTER TABLE public.study_quiz_sets
  ADD CONSTRAINT study_quiz_sets_draft_status_check
  CHECK (draft_status IS NULL OR draft_status IN ('draft', 'kept', 'discarded'));

CREATE INDEX IF NOT EXISTS study_quiz_sets_ai_draft_lookup_idx
  ON public.study_quiz_sets (created_by, source_material_id, draft_status, draft_expires_at DESC)
  WHERE source = 'ai_generated';

COMMENT ON COLUMN public.study_quiz_sets.draft_status IS
  'Personal AI generation lifecycle: draft, kept, or discarded.';

COMMENT ON COLUMN public.study_quiz_sets.draft_expires_at IS
  'When an abandoned personal AI draft should stop being offered for resume.';

COMMENT ON COLUMN public.study_quiz_sets.generation_config IS
  'JSON metadata describing the AI generation request and provider summary.';
