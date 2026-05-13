-- Course-rep AI question bank builder.
-- Tracks official AI-assisted practice banks before they are published to students.

ALTER TABLE public.study_quiz_questions
  ADD COLUMN IF NOT EXISTS source_material_id uuid REFERENCES public.study_materials(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_topic text,
  ADD COLUMN IF NOT EXISTS ai_generated boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.study_question_bank_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.study_courses(id) ON DELETE CASCADE,
  course_code text NOT NULL,
  quiz_set_id uuid NOT NULL REFERENCES public.study_quiz_sets(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'completed', 'failed')),
  selected_materials jsonb NOT NULL DEFAULT '[]'::jsonb,
  batch_size integer NOT NULL DEFAULT 5,
  topic_target integer NOT NULL DEFAULT 3,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.study_question_bank_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.study_question_bank_runs(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.study_materials(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'outlined', 'generating', 'covered', 'failed')),
  topic_outline jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_count integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, material_id)
);

CREATE INDEX IF NOT EXISTS study_question_bank_runs_course_idx
  ON public.study_question_bank_runs (course_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS study_question_bank_runs_quiz_set_idx
  ON public.study_question_bank_runs (quiz_set_id);

CREATE INDEX IF NOT EXISTS study_question_bank_materials_run_idx
  ON public.study_question_bank_materials (run_id, position);

CREATE INDEX IF NOT EXISTS study_quiz_questions_source_material_idx
  ON public.study_quiz_questions (source_material_id);
