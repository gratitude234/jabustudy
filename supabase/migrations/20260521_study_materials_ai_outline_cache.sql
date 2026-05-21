-- Add AI outline cache columns to study_materials.
-- The outline is a JSON list of topics (with chunk IDs and exam angles) produced
-- by buildSourceOutline in lib/studyQuestionGeneration.ts. Caching it avoids
-- a redundant AI call when the coverage engine has not yet built a plan.
ALTER TABLE study_materials
  ADD COLUMN IF NOT EXISTS ai_outline jsonb,
  ADD COLUMN IF NOT EXISTS ai_outline_at timestamptz;
