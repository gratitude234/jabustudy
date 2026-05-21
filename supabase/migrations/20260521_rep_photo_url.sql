ALTER TABLE public.study_rep_applications
  ADD COLUMN IF NOT EXISTS level integer,
  ADD COLUMN IF NOT EXISTS photo_url text;

ALTER TABLE public.study_reps
  ADD COLUMN IF NOT EXISTS photo_url text;
