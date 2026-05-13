-- Fix corrupted study_materials rows by re-syncing denormalized columns
-- from their linked study_courses row.
-- Only updates rows where any denormalized field is out of sync.
-- Run once in the Supabase SQL editor after deploying the approval fix.

UPDATE study_materials sm
SET
  department_id = sc.department_id,
  department    = sc.department,
  faculty_id    = sc.faculty_id,
  faculty       = sc.faculty,
  level         = sc.level::text,
  semester      = sc.semester,
  course_code   = sc.course_code,
  updated_at    = now()
FROM study_courses sc
WHERE sm.course_id = sc.id
  AND (
    sm.department_id IS DISTINCT FROM sc.department_id OR
    sm.faculty_id    IS DISTINCT FROM sc.faculty_id    OR
    sm.level         IS DISTINCT FROM sc.level::text   OR
    sm.semester      IS DISTINCT FROM sc.semester      OR
    sm.course_code   IS DISTINCT FROM sc.course_code
  );
