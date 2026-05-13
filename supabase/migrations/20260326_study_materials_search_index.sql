-- C-1: Add GIN index on study_materials for fast text search across
-- title, course_code, department, faculty columns.

CREATE INDEX IF NOT EXISTS study_materials_search_idx
ON public.study_materials
USING gin (
  (
    to_tsvector('english', coalesce(title, '')) ||
    to_tsvector('simple',  coalesce(course_code, '')) ||
    to_tsvector('simple',  coalesce(department, '')) ||
    to_tsvector('simple',  coalesce(faculty, ''))
  )
);
