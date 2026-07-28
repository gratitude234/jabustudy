-- Broadcast announcements to every JabuStudy user.
--
-- A campaign is processed in batches by a worker route rather than in a single
-- request: `cursor_id` is the last profiles.id already handled, so a crashed or
-- timed-out batch resumes from where it stopped instead of re-sending to
-- everyone. Push notifications cannot be unsent, so `tested_at` gates the send:
-- the admin must send the announcement to themselves first.
--
-- No RLS policies are defined on purpose — this table is service-role only and
-- is never read from the browser.

-- Shared trigger function. Defined here too because 20260320 also touches
-- vendor/rider push tables and may never have been applied to a given project.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.announcements (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Push title/body. Kept short deliberately: Android and iOS clip notification
  -- bodies to a few lines, so the full message lives at `href`.
  title        text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 60),
  body         text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 200),
  href         text        NOT NULL DEFAULT '/support',

  status       text        NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft', 'sending', 'sent', 'cancelled')),

  -- Resume point: last public.profiles.id processed, ordered by id.
  cursor_id    uuid,

  targeted     integer     NOT NULL DEFAULT 0,  -- in-app notification rows written
  pushed       integer     NOT NULL DEFAULT 0,  -- web push messages accepted
  failed       integer     NOT NULL DEFAULT 0,

  tested_at    timestamptz,                     -- set by the /test route
  created_by   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  started_at   timestamptz,
  finished_at  timestamptz
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- The worker claims the oldest in-flight campaign; partial index keeps that cheap.
CREATE INDEX IF NOT EXISTS announcements_sending_idx
  ON public.announcements (created_at)
  WHERE status = 'sending';

DROP TRIGGER IF EXISTS trg_announcements_updated_at ON public.announcements;
CREATE TRIGGER trg_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Dedupe support: notification rows are typed 'announcement_<id>', so a re-run
-- of a batch can skip users who already received the campaign.
CREATE INDEX IF NOT EXISTS notifications_user_type_idx
  ON public.notifications (user_id, type);
