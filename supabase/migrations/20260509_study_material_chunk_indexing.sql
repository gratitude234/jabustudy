-- Material source chunks for grounded guided hints.
-- Run after 20260509_study_quiz_question_study_ref.sql.

ALTER TABLE public.study_materials
  ADD COLUMN IF NOT EXISTS index_status text NOT NULL DEFAULT 'pending'
    CHECK (index_status IN ('pending', 'indexing', 'ready', 'failed', 'skipped')),
  ADD COLUMN IF NOT EXISTS indexed_at timestamptz,
  ADD COLUMN IF NOT EXISTS index_error text;

CREATE TABLE IF NOT EXISTS public.study_material_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.study_materials(id) ON DELETE CASCADE,
  page_number integer,
  chunk_index integer NOT NULL,
  text text NOT NULL,
  text_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (material_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS study_material_chunks_material_idx
  ON public.study_material_chunks(material_id, chunk_index);

CREATE INDEX IF NOT EXISTS study_material_chunks_page_idx
  ON public.study_material_chunks(material_id, page_number);

ALTER TABLE public.study_quiz_questions
  ADD COLUMN IF NOT EXISTS source_chunk_id uuid
    REFERENCES public.study_material_chunks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS study_quiz_questions_source_chunk_idx
  ON public.study_quiz_questions(source_chunk_id);

COMMENT ON TABLE public.study_material_chunks IS
  'Searchable source chunks extracted from approved study materials for grounded guided hints.';

COMMENT ON COLUMN public.study_quiz_questions.source_chunk_id IS
  'Optional direct source chunk used by AI when generating this question.';
