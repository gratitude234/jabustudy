-- Leaderboard v2: immutable point ledger + scoped/ranked leaderboard helpers.
-- Apply after 20260525_study_credit_spend_rpc.sql.

-- Standardize legacy vote-table column naming. Some app code historically used
-- voter_id while the bootstrap schema used user_id.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'study_question_votes' AND column_name = 'voter_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'study_question_votes' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.study_question_votes RENAME COLUMN voter_id TO user_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'study_answer_votes' AND column_name = 'voter_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'study_answer_votes' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.study_answer_votes RENAME COLUMN voter_id TO user_id;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS study_question_votes_question_user_unique
ON public.study_question_votes(question_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS study_answer_votes_answer_user_unique
ON public.study_answer_votes(answer_id, user_id);

CREATE TABLE IF NOT EXISTS public.study_point_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  points int NOT NULL CHECK (points <> 0),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_type, source_table, source_id, user_id)
);

CREATE INDEX IF NOT EXISTS study_point_events_user_occurred_idx
ON public.study_point_events(user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS study_point_events_type_occurred_idx
ON public.study_point_events(event_type, occurred_at DESC);

ALTER TABLE public.study_point_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "study_point_events_read_own" ON public.study_point_events;
CREATE POLICY "study_point_events_read_own"
ON public.study_point_events
FOR SELECT
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.wat_date(p_at timestamptz DEFAULT now())
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT ((p_at AT TIME ZONE 'UTC') + interval '1 hour')::date;
$$;

CREATE OR REPLACE FUNCTION public.wat_week_start_utc(p_at timestamptz DEFAULT now())
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT (date_trunc('week', ((p_at AT TIME ZONE 'UTC') + interval '1 hour')) - interval '1 hour') AT TIME ZONE 'UTC';
$$;

CREATE OR REPLACE FUNCTION public.award_study_points(
  p_user_id uuid,
  p_event_type text,
  p_source_table text,
  p_source_id uuid,
  p_points int,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_occurred_at timestamptz DEFAULT now()
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_points int := COALESCE(p_points, 0);
BEGIN
  IF p_user_id IS NULL OR p_source_id IS NULL OR v_points = 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.study_point_events(
    user_id, event_type, source_table, source_id, points, metadata, occurred_at
  )
  VALUES (
    p_user_id,
    NULLIF(BTRIM(p_event_type), ''),
    NULLIF(BTRIM(p_source_table), ''),
    p_source_id,
    v_points,
    COALESCE(p_metadata, '{}'::jsonb),
    COALESCE(p_occurred_at, now())
  )
  ON CONFLICT (event_type, source_table, source_id, user_id) DO NOTHING;

  IF FOUND THEN
    RETURN v_points;
  END IF;

  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.award_capped_study_points(
  p_user_id uuid,
  p_event_type text,
  p_source_table text,
  p_source_id uuid,
  p_points int,
  p_daily_cap int,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_occurred_at timestamptz DEFAULT now()
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_requested int := GREATEST(COALESCE(p_points, 0), 0);
  v_cap int := GREATEST(COALESCE(p_daily_cap, 0), 0);
  v_day date := public.wat_date(COALESCE(p_occurred_at, now()));
  v_used int := 0;
  v_award int := 0;
BEGIN
  IF p_user_id IS NULL OR p_source_id IS NULL OR v_requested = 0 OR v_cap = 0 THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(SUM(points), 0)::int
  INTO v_used
  FROM public.study_point_events
  WHERE user_id = p_user_id
    AND event_type = p_event_type
    AND points > 0
    AND public.wat_date(occurred_at) = v_day;

  v_award := LEAST(v_requested, GREATEST(v_cap - v_used, 0));
  IF v_award <= 0 THEN
    RETURN 0;
  END IF;

  RETURN public.award_study_points(
    p_user_id,
    p_event_type,
    p_source_table,
    p_source_id,
    v_award,
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('dailyCap', v_cap, 'requestedPoints', v_requested),
    COALESCE(p_occurred_at, now())
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_study_question_upvote(
  p_question_id uuid,
  p_user_id uuid
)
RETURNS TABLE(upvoted boolean, count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_question record;
  v_vote_id uuid;
  v_new_count int;
BEGIN
  SELECT id, author_id, upvotes_count
  INTO v_question
  FROM public.study_questions
  WHERE id = p_question_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Question not found.';
  END IF;

  IF v_question.author_id IS NOT NULL AND v_question.author_id = p_user_id THEN
    RAISE EXCEPTION 'You cannot upvote your own question.';
  END IF;

  SELECT id INTO v_vote_id
  FROM public.study_question_votes
  WHERE question_id = p_question_id AND user_id = p_user_id;

  IF v_vote_id IS NOT NULL THEN
    DELETE FROM public.study_question_votes WHERE id = v_vote_id;
    v_new_count := GREATEST(COALESCE(v_question.upvotes_count, 0) - 1, 0);
    UPDATE public.study_questions SET upvotes_count = v_new_count, updated_at = now() WHERE id = p_question_id;

    IF v_question.author_id IS NOT NULL THEN
      PERFORM public.award_study_points(
        v_question.author_id,
        'question_upvote_removed',
        'study_question_votes',
        v_vote_id,
        -1,
        jsonb_build_object('questionId', p_question_id, 'voterId', p_user_id),
        now()
      );
    END IF;

    RETURN QUERY SELECT false, v_new_count;
    RETURN;
  END IF;

  INSERT INTO public.study_question_votes(question_id, user_id)
  VALUES (p_question_id, p_user_id)
  RETURNING id INTO v_vote_id;

  v_new_count := COALESCE(v_question.upvotes_count, 0) + 1;
  UPDATE public.study_questions SET upvotes_count = v_new_count, updated_at = now() WHERE id = p_question_id;

  IF v_question.author_id IS NOT NULL THEN
    PERFORM public.award_study_points(
      v_question.author_id,
      'question_upvote_received',
      'study_question_votes',
      v_vote_id,
      1,
      jsonb_build_object('questionId', p_question_id, 'voterId', p_user_id),
      now()
    );
  END IF;

  RETURN QUERY SELECT true, v_new_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_study_answer_upvote(
  p_answer_id uuid,
  p_user_id uuid
)
RETURNS TABLE(upvoted boolean, count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_answer record;
  v_vote_id uuid;
  v_new_count int;
BEGIN
  SELECT id, author_id, upvotes_count
  INTO v_answer
  FROM public.study_answers
  WHERE id = p_answer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Answer not found.';
  END IF;

  IF v_answer.author_id IS NOT NULL AND v_answer.author_id = p_user_id THEN
    RAISE EXCEPTION 'You cannot upvote your own answer.';
  END IF;

  SELECT id INTO v_vote_id
  FROM public.study_answer_votes
  WHERE answer_id = p_answer_id AND user_id = p_user_id;

  IF v_vote_id IS NOT NULL THEN
    DELETE FROM public.study_answer_votes WHERE id = v_vote_id;
    v_new_count := GREATEST(COALESCE(v_answer.upvotes_count, 0) - 1, 0);
    UPDATE public.study_answers SET upvotes_count = v_new_count, updated_at = now() WHERE id = p_answer_id;

    IF v_answer.author_id IS NOT NULL THEN
      PERFORM public.award_study_points(
        v_answer.author_id,
        'answer_upvote_removed',
        'study_answer_votes',
        v_vote_id,
        -2,
        jsonb_build_object('answerId', p_answer_id, 'voterId', p_user_id),
        now()
      );
    END IF;

    RETURN QUERY SELECT false, v_new_count;
    RETURN;
  END IF;

  INSERT INTO public.study_answer_votes(answer_id, user_id)
  VALUES (p_answer_id, p_user_id)
  RETURNING id INTO v_vote_id;

  v_new_count := COALESCE(v_answer.upvotes_count, 0) + 1;
  UPDATE public.study_answers SET upvotes_count = v_new_count, updated_at = now() WHERE id = p_answer_id;

  IF v_answer.author_id IS NOT NULL THEN
    PERFORM public.award_study_points(
      v_answer.author_id,
      'answer_upvote_received',
      'study_answer_votes',
      v_vote_id,
      2,
      jsonb_build_object('answerId', p_answer_id, 'voterId', p_user_id),
      now()
    );
  END IF;

  RETURN QUERY SELECT true, v_new_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_study_answer(
  p_question_id uuid,
  p_answer_id uuid,
  p_actor_id uuid
)
RETURNS TABLE(previous_answer_id uuid, previous_author_id uuid, accepted_author_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_question record;
  v_answer record;
  v_previous record;
BEGIN
  SELECT id, author_id
  INTO v_question
  FROM public.study_questions
  WHERE id = p_question_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Question not found.';
  END IF;

  IF v_question.author_id IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION 'Only the question owner can accept an answer.';
  END IF;

  SELECT id, author_id, question_id, is_accepted
  INTO v_answer
  FROM public.study_answers
  WHERE id = p_answer_id AND question_id = p_question_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Answer not found.';
  END IF;

  SELECT id, author_id
  INTO v_previous
  FROM public.study_answers
  WHERE question_id = p_question_id AND is_accepted = true
  LIMIT 1;

  IF v_previous.id IS NOT NULL AND v_previous.id = p_answer_id THEN
    RETURN QUERY SELECT v_previous.id, v_previous.author_id, v_answer.author_id;
    RETURN;
  END IF;

  UPDATE public.study_answers
  SET is_accepted = false, updated_at = now()
  WHERE question_id = p_question_id AND is_accepted = true;

  UPDATE public.study_answers
  SET is_accepted = true, updated_at = now()
  WHERE id = p_answer_id;

  UPDATE public.study_questions
  SET solved = true, updated_at = now()
  WHERE id = p_question_id;

  IF v_previous.author_id IS NOT NULL AND v_previous.author_id <> p_actor_id THEN
    PERFORM public.award_study_points(
      v_previous.author_id,
      'answer_accepted_reversed',
      'study_answers',
      gen_random_uuid(),
      -10,
      jsonb_build_object('questionId', p_question_id, 'answerId', v_previous.id, 'replacedByAnswerId', p_answer_id),
      now()
    );
  END IF;

  IF v_answer.author_id IS NOT NULL AND v_answer.author_id <> p_actor_id THEN
    PERFORM public.award_study_points(
      v_answer.author_id,
      'answer_accepted',
      'study_answers',
      gen_random_uuid(),
      10,
      jsonb_build_object('questionId', p_question_id, 'answerId', p_answer_id, 'acceptedBy', p_actor_id),
      now()
    );
  END IF;

  RETURN QUERY SELECT v_previous.id, v_previous.author_id, v_answer.author_id;
END;
$$;

-- Backfill a baseline ledger from existing data. These INSERTs are idempotent.
INSERT INTO public.study_point_events(user_id, event_type, source_table, source_id, points, occurred_at, metadata)
SELECT author_id, 'question_asked', 'study_questions', id, 1, created_at, '{}'::jsonb
FROM public.study_questions
WHERE author_id IS NOT NULL
ON CONFLICT (event_type, source_table, source_id, user_id) DO NOTHING;

INSERT INTO public.study_point_events(user_id, event_type, source_table, source_id, points, occurred_at, metadata)
SELECT
  author_id,
  'question_upvote_backfill',
  'study_questions',
  id,
  upvotes_count,
  updated_at,
  jsonb_build_object('count', upvotes_count)
FROM public.study_questions
WHERE author_id IS NOT NULL AND COALESCE(upvotes_count, 0) > 0
ON CONFLICT (event_type, source_table, source_id, user_id) DO NOTHING;

INSERT INTO public.study_point_events(user_id, event_type, source_table, source_id, points, occurred_at, metadata)
SELECT author_id, 'answer_posted', 'study_answers', id, 2, created_at, '{}'::jsonb
FROM public.study_answers
WHERE author_id IS NOT NULL
ON CONFLICT (event_type, source_table, source_id, user_id) DO NOTHING;

INSERT INTO public.study_point_events(user_id, event_type, source_table, source_id, points, occurred_at, metadata)
SELECT author_id, 'answer_accepted', 'study_answers', id, 10, updated_at, jsonb_build_object('questionId', question_id)
FROM public.study_answers
WHERE author_id IS NOT NULL AND is_accepted = true
ON CONFLICT (event_type, source_table, source_id, user_id) DO NOTHING;

INSERT INTO public.study_point_events(user_id, event_type, source_table, source_id, points, occurred_at, metadata)
SELECT
  author_id,
  'answer_upvote_backfill',
  'study_answers',
  id,
  upvotes_count * 2,
  updated_at,
  jsonb_build_object('count', upvotes_count)
FROM public.study_answers
WHERE author_id IS NOT NULL AND COALESCE(upvotes_count, 0) > 0
ON CONFLICT (event_type, source_table, source_id, user_id) DO NOTHING;

INSERT INTO public.study_point_events(user_id, event_type, source_table, source_id, points, occurred_at, metadata)
SELECT
  user_id,
  'practice_daily_backfill',
  'study_daily_activity',
  id,
  LEAST(COALESCE(correct_answers, 0) + (COALESCE(attempts_count, 0) * 3), 100),
  updated_at,
  jsonb_build_object(
    'activityDate', activity_date,
    'correctAnswers', correct_answers,
    'attemptsCount', attempts_count,
    'dailyCap', 100
  )
FROM public.study_daily_activity
WHERE COALESCE(correct_answers, 0) + COALESCE(attempts_count, 0) > 0
ON CONFLICT (event_type, source_table, source_id, user_id) DO NOTHING;

DROP VIEW IF EXISTS public.study_leaderboard_weekly_v;
DROP VIEW IF EXISTS public.study_leaderboard_v;

CREATE OR REPLACE VIEW public.study_leaderboard_v AS
WITH agg AS (
  SELECT
    user_id,
    SUM(points)::int AS points,
    SUM(points) FILTER (WHERE event_type IN ('practice_attempt_scored', 'practice_daily_backfill'))::int AS practice_points,
    COUNT(DISTINCT public.wat_date(occurred_at)) FILTER (WHERE event_type IN ('practice_attempt_scored', 'practice_daily_backfill') AND points > 0)::int AS practice_days,
    COUNT(*) FILTER (WHERE event_type = 'question_asked' AND points > 0)::int AS questions,
    COALESCE(SUM(
      CASE
        WHEN event_type IN ('question_upvote_received', 'question_upvote_backfill') THEN GREATEST(points, 0)
        WHEN event_type = 'question_upvote_removed' THEN LEAST(points, 0)
        ELSE 0
      END
    ), 0)::int AS question_upvotes,
    COUNT(*) FILTER (WHERE event_type = 'answer_posted' AND points > 0)::int AS answers,
    COUNT(*) FILTER (WHERE event_type = 'answer_accepted' AND points > 0)::int
      - COUNT(*) FILTER (WHERE event_type = 'answer_accepted_reversed' AND points < 0)::int AS accepted,
    MAX(occurred_at) AS last_activity_at,
    COUNT(DISTINCT public.wat_date(occurred_at))::int AS active_days
  FROM public.study_point_events
  GROUP BY user_id
)
SELECT
  a.user_id,
  p.email,
  COALESCE(a.questions, 0) AS questions,
  GREATEST(COALESCE(a.question_upvotes, 0), 0) AS question_upvotes,
  COALESCE(a.answers, 0) AS answers,
  GREATEST(COALESCE(a.accepted, 0), 0) AS accepted,
  COALESCE(a.practice_points, 0) AS practice_points,
  COALESCE(a.practice_days, 0) AS practice_days,
  COALESCE(a.points, 0) AS points,
  COALESCE(a.active_days, 0) AS active_days,
  a.last_activity_at,
  RANK() OVER (ORDER BY COALESCE(a.points, 0) DESC, COALESCE(a.active_days, 0) DESC, a.last_activity_at DESC, a.user_id ASC)::int AS rank
FROM agg a
LEFT JOIN public.profiles p ON p.id = a.user_id
WHERE COALESCE(a.points, 0) <> 0;

CREATE OR REPLACE VIEW public.study_leaderboard_weekly_v AS
WITH agg AS (
  SELECT
    user_id,
    SUM(points)::int AS total_points,
    SUM(points) FILTER (WHERE event_type IN ('practice_attempt_scored', 'practice_daily_backfill'))::int AS practice_points,
    COUNT(DISTINCT public.wat_date(occurred_at)) FILTER (WHERE points > 0)::int AS active_days,
    MAX(occurred_at) AS last_activity_at
  FROM public.study_point_events
  WHERE occurred_at >= public.wat_week_start_utc(now())
  GROUP BY user_id
)
SELECT
  user_id,
  COALESCE(total_points, 0) AS total_points,
  COALESCE(active_days, 0) AS active_days,
  COALESCE(practice_points, 0) AS practice_points,
  last_activity_at,
  RANK() OVER (ORDER BY COALESCE(total_points, 0) DESC, COALESCE(active_days, 0) DESC, last_activity_at DESC, user_id ASC)::int AS rank
FROM agg
WHERE COALESCE(total_points, 0) <> 0;

CREATE OR REPLACE FUNCTION public.get_study_leaderboard(
  p_scope text DEFAULT 'all',
  p_user_id uuid DEFAULT NULL,
  p_period text DEFAULT 'all',
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE(
  user_id uuid,
  email text,
  questions int,
  question_upvotes int,
  answers int,
  accepted int,
  practice_points int,
  practice_days int,
  points int,
  active_days int,
  last_activity_at timestamptz,
  rank int
)
LANGUAGE sql
STABLE
AS $$
  WITH viewer AS (
    SELECT department_id, level
    FROM public.study_preferences
    WHERE user_id = p_user_id
  ),
  scoped_users AS (
    SELECT sp.user_id
    FROM public.study_preferences sp, viewer v
    WHERE
      p_scope = 'all'
      OR (p_scope = 'dept' AND v.department_id IS NOT NULL AND sp.department_id = v.department_id)
      OR (p_scope = 'level' AND v.level IS NOT NULL AND sp.level = v.level)
  ),
  base AS (
    SELECT
      l.user_id,
      l.email,
      l.questions,
      l.question_upvotes,
      l.answers,
      l.accepted,
      l.practice_points,
      l.practice_days,
      l.points,
      l.active_days,
      l.last_activity_at
    FROM public.study_leaderboard_v l
    WHERE
      COALESCE(p_period, 'all') <> 'week'
      AND (p_scope = 'all' OR l.user_id IN (SELECT su.user_id FROM scoped_users su))

    UNION ALL

    SELECT
      w.user_id,
      p.email,
      0 AS questions,
      0 AS question_upvotes,
      0 AS answers,
      0 AS accepted,
      w.practice_points,
      w.active_days AS practice_days,
      w.total_points AS points,
      w.active_days,
      w.last_activity_at
    FROM public.study_leaderboard_weekly_v w
    LEFT JOIN public.profiles p ON p.id = w.user_id
    WHERE
      COALESCE(p_period, 'all') = 'week'
      AND (p_scope = 'all' OR w.user_id IN (SELECT su.user_id FROM scoped_users su))
  )
  SELECT
    b.user_id,
    b.email,
    b.questions,
    b.question_upvotes,
    b.answers,
    b.accepted,
    b.practice_points,
    b.practice_days,
    b.points,
    b.active_days,
    b.last_activity_at,
    RANK() OVER (ORDER BY b.points DESC, b.active_days DESC, b.last_activity_at DESC, b.user_id ASC)::int AS rank
  FROM base b
  ORDER BY b.points DESC, b.active_days DESC, b.last_activity_at DESC, b.user_id ASC
  LIMIT GREATEST(COALESCE(p_limit, 50), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION public.award_study_points(uuid, text, text, uuid, int, jsonb, timestamptz) FROM public;
REVOKE ALL ON FUNCTION public.award_capped_study_points(uuid, text, text, uuid, int, int, jsonb, timestamptz) FROM public;
REVOKE ALL ON FUNCTION public.toggle_study_question_upvote(uuid, uuid) FROM public;
REVOKE ALL ON FUNCTION public.toggle_study_answer_upvote(uuid, uuid) FROM public;
REVOKE ALL ON FUNCTION public.accept_study_answer(uuid, uuid, uuid) FROM public;

GRANT EXECUTE ON FUNCTION public.award_study_points(uuid, text, text, uuid, int, jsonb, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.award_capped_study_points(uuid, text, text, uuid, int, int, jsonb, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.toggle_study_question_upvote(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.toggle_study_answer_upvote(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.accept_study_answer(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_study_leaderboard(text, uuid, text, int, int) TO authenticated, service_role;

COMMENT ON COLUMN public.study_attempt_answers.ai_grade_score IS
  'AI-assisted written-answer score. Does not affect official MCQ score, but eligible scores may award capped leaderboard practice points.';
