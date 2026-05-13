CREATE TABLE IF NOT EXISTS public.study_course_setup_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id uuid REFERENCES public.study_faculties(id) ON DELETE SET NULL,
  department_id uuid NOT NULL REFERENCES public.study_departments(id) ON DELETE CASCADE,
  level integer NOT NULL,
  semester text NOT NULL CHECK (semester IN ('first', 'second', 'summer')),
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'complete')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT study_course_setup_status_scope_unique UNIQUE (department_id, level, semester)
);

CREATE INDEX IF NOT EXISTS study_course_setup_status_scope_idx
  ON public.study_course_setup_status (department_id, level, semester, status);

ALTER TABLE public.study_course_setup_status ENABLE ROW LEVEL SECURITY;
