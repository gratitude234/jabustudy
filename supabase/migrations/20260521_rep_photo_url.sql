ALTER TABLE public.study_rep_applications
  ADD COLUMN IF NOT EXISTS level integer,
  ADD COLUMN IF NOT EXISTS levels integer[],
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS admin_note text,
  ADD COLUMN IF NOT EXISTS decision_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS photo_url text;

ALTER TABLE public.study_reps
  ADD COLUMN IF NOT EXISTS photo_url text;
