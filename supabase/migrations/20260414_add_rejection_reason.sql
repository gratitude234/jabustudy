ALTER TABLE public.study_materials
  ADD COLUMN IF NOT EXISTS rejection_reason text;
