-- Ensure practice answer upserts can target one row per attempt/question.
-- Some databases created from incremental migrations may be missing the
-- bootstrap unique constraint on (attempt_id, question_id).

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY attempt_id, question_id
      ORDER BY answered_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.study_attempt_answers
)
DELETE FROM public.study_attempt_answers a
USING ranked r
WHERE a.id = r.id
  AND r.rn > 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.study_attempt_answers'::regclass
      AND contype = 'u'
      AND conkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.study_attempt_answers'::regclass AND attname = 'attempt_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.study_attempt_answers'::regclass AND attname = 'question_id')
      ]::smallint[]
  ) THEN
    ALTER TABLE public.study_attempt_answers
      ADD CONSTRAINT study_attempt_answers_attempt_question_unique
      UNIQUE (attempt_id, question_id);
  END IF;
END $$;
