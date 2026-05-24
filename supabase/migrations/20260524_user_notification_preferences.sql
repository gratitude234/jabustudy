-- Per-category push notification preferences.
-- One row per user, created lazily on first PATCH.
-- Uses an opt-out model: absence of a category key = enabled.
-- Stored as JSONB so new categories can be added without schema changes.
-- Example push_categories value: {"reminders": false, "upvotes": false}

CREATE TABLE public.user_notification_preferences (
  user_id          uuid        NOT NULL PRIMARY KEY
                               REFERENCES auth.users(id) ON DELETE CASCADE,
  push_categories  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notification preferences"
  ON public.user_notification_preferences
  FOR ALL USING (auth.uid() = user_id);

CREATE TRIGGER trg_user_notif_prefs_updated_at
  BEFORE UPDATE ON public.user_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
