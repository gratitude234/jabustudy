ALTER TABLE public.study_reps
  ADD COLUMN IF NOT EXISTS courses_setup_done boolean NOT NULL DEFAULT false;

-- dept_librarians have no course obligation — mark them done
UPDATE public.study_reps
SET courses_setup_done = true
WHERE role = 'dept_librarian';

-- course_reps who already have at least one course per level are considered done
UPDATE public.study_reps r
SET courses_setup_done = true
WHERE r.role = 'course_rep'
  AND r.levels IS NOT NULL
  AND array_length(r.levels, 1) > 0
  AND (
    SELECT count(DISTINCT c.level)
    FROM public.study_courses c
    WHERE c.department_id = r.department_id
      AND c.level = ANY(r.levels)
  ) >= array_length(r.levels, 1);
