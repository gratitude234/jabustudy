-- Persistent GPA calculator data per user.
-- Stores the full GpaPayload as JSONB so schema changes don't require column migrations.
CREATE TABLE IF NOT EXISTS public.study_gpa_data (
  user_id     UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data        JSONB        NOT NULL,
  updated_at  TIMESTAMPTZ  NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE public.study_gpa_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own GPA data"
  ON public.study_gpa_data
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
