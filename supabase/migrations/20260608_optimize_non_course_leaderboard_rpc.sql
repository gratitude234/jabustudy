-- Optimize get_study_leaderboard for the common non-course scopes.
-- Non-course leaderboards no longer build course context joins on every call.

CREATE OR REPLACE FUNCTION public.get_study_leaderboard(
  p_scope text DEFAULT 'all',
  p_user_id uuid DEFAULT NULL,
  p_period text DEFAULT 'all',
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_course_code text DEFAULT NULL
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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_scope text := lower(coalesce(nullif(btrim(p_scope), ''), 'all'));
  v_course_code_norm text := public.normalize_study_course_code(p_course_code);
  v_start_at timestamptz;
  v_end_at timestamptz;
BEGIN
  SELECT b.start_at, b.end_at
  INTO v_start_at, v_end_at
  FROM public.study_period_bounds(p_period, now()) AS b;

  IF v_scope = 'course' THEN
    RETURN QUERY
    WITH base_events AS (
      SELECT e.*
      FROM public.study_point_events e
      WHERE
        (v_start_at IS NULL OR e.occurred_at >= v_start_at)
        AND (v_end_at IS NULL OR e.occurred_at < v_end_at)
    ),
    event_course_context AS (
      SELECT
        e.id AS event_id,
        coalesce(
          practice_qs.course_code,
          written_qs.course_code,
          direct_question.course_code,
          vote_question.course_code,
          metadata_question.course_code,
          direct_answer_question.course_code,
          vote_answer_question.course_code,
          metadata_answer_question.course_code,
          e.metadata->>'courseCode'
        ) AS course_code
      FROM base_events e
      LEFT JOIN public.study_practice_attempts practice_attempt
        ON e.source_table = 'study_practice_attempts'
       AND practice_attempt.id = e.source_id
      LEFT JOIN public.study_quiz_sets practice_qs
        ON practice_qs.id = practice_attempt.set_id

      LEFT JOIN public.study_attempt_answers written_answer
        ON e.source_table = 'study_attempt_answers'
       AND written_answer.id = e.source_id
      LEFT JOIN public.study_practice_attempts written_attempt
        ON written_attempt.id = written_answer.attempt_id
      LEFT JOIN public.study_quiz_sets written_qs
        ON written_qs.id = written_attempt.set_id

      LEFT JOIN public.study_questions direct_question
        ON e.source_table = 'study_questions'
       AND direct_question.id = e.source_id

      LEFT JOIN public.study_question_votes question_vote
        ON e.source_table = 'study_question_votes'
       AND question_vote.id = e.source_id
      LEFT JOIN public.study_questions vote_question
        ON vote_question.id = question_vote.question_id
      LEFT JOIN public.study_questions metadata_question
        ON metadata_question.id = (
          CASE
            WHEN e.metadata->>'questionId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN (e.metadata->>'questionId')::uuid
            ELSE NULL::uuid
          END
        )

      LEFT JOIN public.study_answers direct_answer
        ON e.source_table = 'study_answers'
       AND direct_answer.id = e.source_id
      LEFT JOIN public.study_questions direct_answer_question
        ON direct_answer_question.id = direct_answer.question_id

      LEFT JOIN public.study_answer_votes answer_vote
        ON e.source_table = 'study_answer_votes'
       AND answer_vote.id = e.source_id
      LEFT JOIN public.study_answers vote_answer
        ON vote_answer.id = answer_vote.answer_id
      LEFT JOIN public.study_questions vote_answer_question
        ON vote_answer_question.id = vote_answer.question_id
      LEFT JOIN public.study_answers metadata_answer
        ON metadata_answer.id = (
          CASE
            WHEN e.metadata->>'answerId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN (e.metadata->>'answerId')::uuid
            ELSE NULL::uuid
          END
        )
      LEFT JOIN public.study_questions metadata_answer_question
        ON metadata_answer_question.id = metadata_answer.question_id
    ),
    filtered_events AS (
      SELECT e.*
      FROM base_events e
      LEFT JOIN event_course_context c ON c.event_id = e.id
      WHERE
        v_course_code_norm <> ''
        AND public.normalize_study_course_code(c.course_code) = v_course_code_norm
    ),
    agg AS (
      SELECT
        e.user_id,
        SUM(e.points)::int AS points,
        COALESCE(SUM(e.points) FILTER (WHERE e.event_type IN ('practice_attempt_scored', 'practice_daily_backfill', 'practice_question_correct')), 0)::int AS practice_points,
        COUNT(DISTINCT public.wat_date(e.occurred_at)) FILTER (WHERE e.event_type IN ('practice_attempt_scored', 'practice_daily_backfill', 'practice_question_correct') AND e.points > 0)::int AS practice_days,
        COUNT(*) FILTER (WHERE e.event_type = 'question_asked' AND e.points > 0)::int AS questions,
        COALESCE(SUM(
          CASE
            WHEN e.event_type IN ('question_upvote_received', 'question_upvote_backfill') THEN GREATEST(e.points, 0)
            WHEN e.event_type = 'question_upvote_removed' THEN LEAST(e.points, 0)
            ELSE 0
          END
        ), 0)::int AS question_upvotes,
        COUNT(*) FILTER (WHERE e.event_type = 'answer_posted' AND e.points > 0)::int AS answers,
        COUNT(*) FILTER (WHERE e.event_type = 'answer_accepted' AND e.points > 0)::int
          - COUNT(*) FILTER (WHERE e.event_type = 'answer_accepted_reversed' AND e.points < 0)::int AS accepted,
        MAX(e.occurred_at) AS last_activity_at,
        COUNT(DISTINCT public.wat_date(e.occurred_at))::int AS active_days
      FROM filtered_events e
      GROUP BY e.user_id
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
    SELECT
      ranked.user_id,
      ranked.email,
      ranked.questions,
      ranked.question_upvotes,
      ranked.answers,
      ranked.accepted,
      ranked.practice_points,
      ranked.practice_days,
      ranked.points,
      ranked.active_days,
      ranked.last_activity_at,
      ranked.rank
    FROM ranked
    ORDER BY ranked.points DESC, ranked.active_days DESC, ranked.last_activity_at DESC, ranked.user_id ASC
    LIMIT GREATEST(COALESCE(p_limit, 50), 1)
    OFFSET GREATEST(COALESCE(p_offset, 0), 0);

    RETURN;
  END IF;

  RETURN QUERY
  WITH viewer AS (
    SELECT sp.faculty_id, sp.department_id, sp.level
    FROM public.study_preferences sp
    WHERE sp.user_id = p_user_id
  ),
  scoped_users AS (
    SELECT sp.user_id
    FROM public.study_preferences sp
    CROSS JOIN viewer v
    WHERE
      (v_scope = 'faculty' AND v.faculty_id IS NOT NULL AND sp.faculty_id = v.faculty_id)
      OR (v_scope = 'dept' AND v.department_id IS NOT NULL AND sp.department_id = v.department_id)
      OR (v_scope = 'level' AND v.level IS NOT NULL AND sp.level = v.level)
  ),
  filtered_events AS (
    SELECT e.*
    FROM public.study_point_events e
    WHERE
      (v_start_at IS NULL OR e.occurred_at >= v_start_at)
      AND (v_end_at IS NULL OR e.occurred_at < v_end_at)
      AND (
        v_scope = 'all'
        OR e.user_id IN (SELECT su.user_id FROM scoped_users su)
      )
  ),
  agg AS (
    SELECT
      e.user_id,
      SUM(e.points)::int AS points,
      COALESCE(SUM(e.points) FILTER (WHERE e.event_type IN ('practice_attempt_scored', 'practice_daily_backfill', 'practice_question_correct')), 0)::int AS practice_points,
      COUNT(DISTINCT public.wat_date(e.occurred_at)) FILTER (WHERE e.event_type IN ('practice_attempt_scored', 'practice_daily_backfill', 'practice_question_correct') AND e.points > 0)::int AS practice_days,
      COUNT(*) FILTER (WHERE e.event_type = 'question_asked' AND e.points > 0)::int AS questions,
      COALESCE(SUM(
        CASE
          WHEN e.event_type IN ('question_upvote_received', 'question_upvote_backfill') THEN GREATEST(e.points, 0)
          WHEN e.event_type = 'question_upvote_removed' THEN LEAST(e.points, 0)
          ELSE 0
        END
      ), 0)::int AS question_upvotes,
      COUNT(*) FILTER (WHERE e.event_type = 'answer_posted' AND e.points > 0)::int AS answers,
      COUNT(*) FILTER (WHERE e.event_type = 'answer_accepted' AND e.points > 0)::int
        - COUNT(*) FILTER (WHERE e.event_type = 'answer_accepted_reversed' AND e.points < 0)::int AS accepted,
      MAX(e.occurred_at) AS last_activity_at,
      COUNT(DISTINCT public.wat_date(e.occurred_at))::int AS active_days
    FROM filtered_events e
    GROUP BY e.user_id
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
  SELECT
    ranked.user_id,
    ranked.email,
    ranked.questions,
    ranked.question_upvotes,
    ranked.answers,
    ranked.accepted,
    ranked.practice_points,
    ranked.practice_days,
    ranked.points,
    ranked.active_days,
    ranked.last_activity_at,
    ranked.rank
  FROM ranked
  ORDER BY ranked.points DESC, ranked.active_days DESC, ranked.last_activity_at DESC, ranked.user_id ASC
  LIMIT GREATEST(COALESCE(p_limit, 50), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_study_leaderboard(text, uuid, text, int, int, text) TO authenticated, service_role;
