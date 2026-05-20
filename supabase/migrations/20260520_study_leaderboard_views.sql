-- Weekly leaderboard view (scope = "week")
-- total_points = sum of correct answers this week; active_days = rows this week.
CREATE OR REPLACE VIEW public.study_leaderboard_weekly_v AS
SELECT
  user_id,
  SUM(COALESCE(correct_answers, 0))::int  AS total_points,
  COUNT(*)::int                            AS active_days
FROM public.study_daily_activity
WHERE activity_date >= date_trunc('week', now())
GROUP BY user_id;

-- All-time leaderboard view (scope = "all" / "dept" / "level")
-- Aggregates questions asked, answers given, upvotes, and practice activity.
-- Points formula: question +1, upvote +1, answer +2, accepted answer +5, practice day +1.
CREATE OR REPLACE VIEW public.study_leaderboard_v AS
SELECT
  p.id                                                        AS user_id,
  p.email,
  COALESCE(q.questions,        0)                            AS questions,
  COALESCE(q.question_upvotes, 0)                            AS question_upvotes,
  COALESCE(a.answers,          0)                            AS answers,
  COALESCE(a.accepted,         0)                            AS accepted,
  COALESCE(d.practice_points,  0)                            AS practice_points,
  COALESCE(d.practice_days,    0)                            AS practice_days,
  (
    COALESCE(q.questions,        0) * 1 +
    COALESCE(q.question_upvotes, 0) * 1 +
    COALESCE(a.answers,          0) * 2 +
    COALESCE(a.accepted,         0) * 5 +
    COALESCE(d.practice_days,    0) * 1
  )                                                           AS points
FROM public.profiles p
LEFT JOIN (
  SELECT
    author_id,
    COUNT(*)           AS questions,
    SUM(upvotes_count) AS question_upvotes
  FROM public.study_questions
  GROUP BY author_id
) q ON q.author_id = p.id
LEFT JOIN (
  SELECT
    author_id,
    COUNT(*)                               AS answers,
    COUNT(*) FILTER (WHERE is_accepted)    AS accepted
  FROM public.study_answers
  GROUP BY author_id
) a ON a.author_id = p.id
LEFT JOIN (
  SELECT
    user_id,
    SUM(COALESCE(correct_answers, 0))::int  AS practice_points,
    COUNT(*)::int                            AS practice_days
  FROM public.study_daily_activity
  GROUP BY user_id
) d ON d.user_id = p.id
WHERE
  COALESCE(q.questions,     0) > 0 OR
  COALESCE(a.answers,       0) > 0 OR
  COALESCE(d.practice_days, 0) > 0;
