ALTER TABLE public.study_quiz_sets
  ADD COLUMN IF NOT EXISTS source_material_id uuid REFERENCES public.study_materials(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS due_at timestamptz;
