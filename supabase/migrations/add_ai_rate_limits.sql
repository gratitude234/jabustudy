ALTER TABLE public.study_materials
ADD COLUMN IF NOT EXISTS gemini_file_uri text;

CREATE TABLE IF NOT EXISTS public.ai_rate_limits (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  last_called_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_rate_limits_user_endpoint_key UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS ai_rate_limits_last_called_at_idx
ON public.ai_rate_limits (last_called_at DESC);
