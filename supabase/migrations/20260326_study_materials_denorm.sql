-- C-1 / C-2: Ensure study_materials columns that already exist in the schema
-- are populated from the joined course row so search and level/semester filters
-- work directly on study_materials without PostgREST join-filter limitations.
-- These columns already exist (course_code, department, faculty, level, semester)
-- but may be null for older rows. This migration backfills them.

UPDATE public.study_materials m
SET
  course_code = c.course_code,
  department  = c.department,
  faculty     = c.faculty,
  level       = c.level::text,
  semester    = c.semester
FROM public.study_courses c
WHERE m.course_id = c.id
  AND (
    m.course_code IS NULL OR
    m.department  IS NULL OR
    m.faculty     IS NULL OR
    m.level       IS NULL OR
    m.semester    IS NULL
  );
