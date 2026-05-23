-- Ensure personal AI-generated practice sets inherit the source material scope.
-- Without this, kept AI drafts can be hidden by the Practice "For you" level/semester filters.

UPDATE public.study_quiz_sets AS qs
SET
  level = COALESCE(
    NULLIF(qs.level::text, ''),
    NULLIF(regexp_replace(COALESCE(sm.level::text, ''), '\D', '', 'g'), '')
  ),
  semester = COALESCE(
    NULLIF(qs.semester, ''),
    CASE
      WHEN lower(trim(COALESCE(sm.semester, ''))) IN ('1st', 'first') THEN 'first'
      WHEN lower(trim(COALESCE(sm.semester, ''))) IN ('2nd', 'second') THEN 'second'
      WHEN lower(trim(COALESCE(sm.semester, ''))) = 'summer' THEN 'summer'
      ELSE NULL
    END
  )
FROM public.study_materials AS sm
WHERE qs.source = 'ai_generated'
  AND qs.source_material_id = sm.id
  AND (
    qs.level IS NULL
    OR NULLIF(qs.level::text, '') IS NULL
    OR qs.semester IS NULL
    OR NULLIF(qs.semester, '') IS NULL
  );
