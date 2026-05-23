-- Material practice sessions: one continuous session per user per material
CREATE TABLE IF NOT EXISTS study_material_sessions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id     UUID        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'completed')),
  total_questions INT         NOT NULL DEFAULT 0,
  total_correct   INT         NOT NULL DEFAULT 0,
  batches         JSONB       NOT NULL DEFAULT '[]'::jsonb,
  -- batches: [{setId, attemptId, count, correct, intent, questionFormat, generatedAt}]
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_material_sessions_user_material
  ON study_material_sessions(user_id, material_id, last_active_at DESC);

ALTER TABLE study_material_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sessions"
  ON study_material_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Credits: simple balance per user. Service role deducts on generation.
CREATE TABLE IF NOT EXISTS study_user_credits (
  user_id     UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance     INT         NOT NULL DEFAULT 20 CHECK (balance >= 0),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE study_user_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own credits"
  ON study_user_credits
  FOR SELECT USING (auth.uid() = user_id);
-- Only service role writes (enforced by not granting INSERT/UPDATE to anon/authenticated)
