-- Leaderboard v2.1: seasonal periods for the ledger-backed leaderboard RPC.
-- Apply after 20260526_study_point_ledger_leaderboard.sql.

CREATE OR REPLACE FUNCTION public.wat_month_start_utc(p_at timestamptz DEFAULT now())
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT (date_trunc('month', ((p_at AT TIME ZONE 'UTC') + interval '1 hour')) - interval '1 hour') AT TIME ZONE 'UTC';
$$;

CREATE OR REPLACE FUNCTION public.study_period_bounds(
  p_period text DEFAULT 'all',
  p_at timestamptz DEFAULT now()
)
RETURNS TABLE(start_at timestamptz, end_at timestamptz)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_period text := lower(coalesce(nullif(btrim(p_period), ''), 'all'));
  v_wat_now timestamp := (coalesce(p_at, now()) AT TIME ZONE 'UTC') + interval '1 hour';
  v_wat_today date := v_wat_now::date;
  v_year int := extract(year from v_wat_today)::int;
  v_month int := extract(month from v_wat_today)::int;
  v_session_start_year int;
  v_start_date date;
  v_end_date date;
BEGIN
  IF v_period = 'week' THEN
    RETURN QUERY SELECT public.wat_week_start_utc(p_at), NULL::timestamptz;
    RETURN;
  END IF;

  IF v_period = 'month' THEN
    RETURN QUERY SELECT public.wat_month_start_utc(p_at), NULL::timestamptz;
    RETURN;
  END IF;

  IF v_period = 'session' THEN
    SELECT min(starts_on)::date, max(ends_on)::date
    INTO v_start_date, v_end_date
    FROM public.study_academic_calendar c
    WHERE v_wat_today BETWEEN c.starts_on AND c.ends_on;

    IF v_start_date IS NULL THEN
      v_session_start_year := CASE WHEN v_month >= 9 THEN v_year ELSE v_year - 1 END;
      v_start_date := make_date(v_session_start_year, 9, 1);
      v_end_date := make_date(v_session_start_year + 1, 8, 31);
    END IF;

    RETURN QUERY SELECT
      ((v_start_date::timestamp - interval '1 hour') AT TIME ZONE 'UTC'),
      (((v_end_date + 1)::timestamp - interval '1 hour') AT TIME ZONE 'UTC');
    RETURN;
  END IF;

  IF v_period = 'semester' THEN
    SELECT c.starts_on::date, c.ends_on::date
    INTO v_start_date, v_end_date
    FROM public.study_academic_calendar c
    WHERE v_wat_today BETWEEN c.starts_on AND c.ends_on
    ORDER BY c.starts_on DESC
    LIMIT 1;

    IF v_start_date IS NULL THEN
      v_session_start_year := CASE WHEN v_month >= 9 THEN v_year ELSE v_year - 1 END;
      IF v_month >= 9 OR v_month <= 2 THEN
        v_start_date := make_date(v_session_start_year, 9, 1);
        v_end_date := (make_date(v_session_start_year + 1, 3, 1) - 1);
      ELSE
        v_start_date := make_date(v_session_start_year + 1, 3, 1);
        v_end_date := make_date(v_session_start_year + 1, 8, 31);
      END IF;
    END IF;

    RETURN QUERY SELECT
      ((v_start_date::timestamp - interval '1 hour') AT TIME ZONE 'UTC'),
      (((v_end_date + 1)::timestamp - interval '1 hour') AT TIME ZONE 'UTC');
    RETURN;
  END IF;

  RETURN QUERY SELECT NULL::timestamptz, NULL::timestamptz;
END;
$$;

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
  WITH bounds AS (
    SELECT start_at, end_at
    FROM public.study_period_bounds(p_period, now())
  ),
  viewer AS (
    SELECT department_id, level
    FROM public.study_preferences
    WHERE user_id = p_user_id
  ),
  scoped_users AS (
    SELECT sp.user_id
    FROM public.study_preferences sp, viewer v
    WHERE
      COALESCE(p_scope, 'all') = 'all'
      OR (p_scope = 'dept' AND v.department_id IS NOT NULL AND sp.department_id = v.department_id)
      OR (p_scope = 'level' AND v.level IS NOT NULL AND sp.level = v.level)
  ),
  filtered_events AS (
    SELECT e.*
    FROM public.study_point_events e, bounds b
    WHERE
      (b.start_at IS NULL OR e.occurred_at >= b.start_at)
      AND (b.end_at IS NULL OR e.occurred_at < b.end_at)
      AND (COALESCE(p_scope, 'all') = 'all' OR e.user_id IN (SELECT user_id FROM scoped_users))
  ),
  agg AS (
    SELECT
      user_id,
      SUM(points)::int AS points,
      COALESCE(SUM(points) FILTER (WHERE event_type IN ('practice_attempt_scored', 'practice_daily_backfill')), 0)::int AS practice_points,
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
    FROM filtered_events
    GROUP BY user_id
  ),
  ranked AS (
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
    WHERE COALESCE(a.points, 0) <> 0
  )
  SELECT *
  FROM ranked
  ORDER BY points DESC, active_days DESC, last_activity_at DESC, user_id ASC
  LIMIT GREATEST(COALESCE(p_limit, 50), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

GRANT EXECUTE ON FUNCTION public.study_period_bounds(text, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_study_leaderboard(text, uuid, text, int, int) TO authenticated, service_role;
