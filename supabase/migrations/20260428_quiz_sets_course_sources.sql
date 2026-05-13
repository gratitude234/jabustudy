-- source: tracks how the set was created (ai_generated, ai_course, etc.)
ALTER TABLE public.study_quiz_sets
  ADD COLUMN IF NOT EXISTS source text DEFAULT NULL;

-- source_material_ids: JSON array of { id, title, material_type } for AI course sets
ALTER TABLE public.study_quiz_sets
  ADD COLUMN IF NOT EXISTS source_material_ids jsonb DEFAULT NULL;
