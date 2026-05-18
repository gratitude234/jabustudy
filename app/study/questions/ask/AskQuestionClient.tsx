"use client";
// app/study/questions/ask/AskQuestionClient.tsx
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, ExternalLink, Loader2, Search, Send, ShieldAlert } from "lucide-react";

const LEVELS    = ["100", "200", "300", "400", "500", "600"] as const;
const TITLE_MAX = 120;
const BODY_MAX  = 3000;

type PersonalizationPayload = {
  ok?: boolean;
  profileStatus?: "complete" | "incomplete" | "missing";
  prefs?: { level?: number | null } | null;
  courses?: Array<{ course_code?: string | null; course_title?: string | null }>;
};

export default function AskQuestionClient() {
  const router = useRouter();
  const sp     = useSearchParams();

  const presetCourse = (sp.get("course") ?? "").trim().toUpperCase();
  const presetLevel  = (sp.get("level") ?? "").trim();

  const [userId,    setUserId]    = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [courseOptions, setCourseOptions] = useState<Array<{ code: string; title: string | null }>>([]);
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);

  const [title,   setTitle]   = useState("");
  const [body,    setBody]    = useState("");
  const [course,  setCourse]  = useState(presetCourse);
  const [level,   setLevel]   = useState(presetLevel);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [similarQuestions, setSimilarQuestions] = useState<Array<{
    id: string;
    title: string;
    answers_count: number | null;
    solved: boolean | null;
    course_code: string | null;
  }>>([]);
  const [similarLoading, setSimilarLoading] = useState(false);

  const canSubmit = useMemo(() => {
    if (!userId) return false;
    return title.trim().length >= 8 && body.trim().length >= 10;
  }, [userId, title, body]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data?.user?.id ?? null);
      setUserEmail(data?.user?.email ?? null);
      if (!data?.user) return;

      try {
        const res = await fetch("/api/study/personalization", { cache: "no-store" });
        const json = (await res.json()) as PersonalizationPayload;
        if (!json?.ok) return;

        setProfileComplete(json.profileStatus === "complete");
        const nextCourses = (json.courses ?? [])
          .map((row) => ({
            code: String(row.course_code ?? "").trim().toUpperCase(),
            title: row.course_title ? String(row.course_title) : null,
          }))
          .filter((row) => row.code);
        setCourseOptions(nextCourses);

        if (!presetLevel && json.prefs?.level) setLevel(String(json.prefs.level));
        if (!presetCourse && nextCourses[0]?.code) setCourse(nextCourses[0].code);
      } catch {
        // personalization is optional for posting
      }
    })();
  }, [presetCourse, presetLevel]);

  useEffect(() => {
    const trimmed = title.trim();
    if (trimmed.length < 15) {
      setSimilarQuestions([]);
      setSimilarLoading(false);
      return;
    }

    let cancelled = false;
    setSimilarLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: trimmed, limit: "3" });
        if (course) params.set("course", course);
        const res = await fetch(`/api/study/search?${params.toString()}`);
        if (!res.ok) throw new Error("search failed");
        const json = (await res.json()) as {
          questions?: Array<{
            id: string;
            title: string;
            answers_count?: number | null;
            solved?: boolean | null;
            course_code?: string | null;
          }>;
        };

        if (cancelled) return;
        const qs = (json.questions ?? []).map((q) => ({
          id: q.id,
          title: q.title,
          answers_count: q.answers_count ?? null,
          solved: q.solved ?? null,
          course_code: q.course_code ?? null,
        }));
        setSimilarQuestions(qs.slice(0, 3));
      } catch {
        if (!cancelled) setSimilarQuestions([]);
      } finally {
        if (!cancelled) setSimilarLoading(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      setSimilarLoading(false);
    };
  }, [title, course]);

  async function submit() {
    setError(null);
    if (!userId) { setError("Please sign in to ask a question."); return; }
    const t = title.trim();
    const b = body.trim();
    if (t.length < 8)  { setError("Title is too short (min 8 characters)."); return; }
    if (b.length < 10) { setError("Please add more detail (min 10 characters)."); return; }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("study_questions")
        .insert({
          title: t, body: b,
          course_code:   course ? course.trim().toUpperCase() : null,
          level:         level ? level.trim() : null,
          author_id:     userId,
          author_email:  userEmail,
          solved:        false,
          answers_count: 0,
          upvotes_count: 0,
        })
        .select("id")
        .single();

      if (error) throw error;
      router.push(`/study/questions/${data.id}`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to post question.");
    } finally {
      setLoading(false);
    }
  }

  const titleRemaining = TITLE_MAX - title.length;
  const bodyRemaining  = BODY_MAX  - body.length;

  return (
    <div className="space-y-4 pb-28 md:pb-6">

      {/* Top bar */}
      <div className="flex items-center gap-3">
        <Link href="/study/questions"
          className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground no-underline hover:bg-secondary/50">
          <ArrowLeft className="h-4 w-4" /> Questions
        </Link>
      </div>

      {/* Page header */}
      <div>
        <h1 className="font-[family-name:var(--font-bricolage)] text-lg font-medium text-foreground">Ask a question</h1>
        <p className="mt-1 text-sm text-muted-brand">
          Be specific — it gets you better answers faster.
        </p>
      </div>

      {/* Auth gate */}
      {!userId && (
        <div className="rounded-2xl border border-primary/20 bg-primary-light p-4 dark:border-primary/30 dark:bg-primary/10">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary">
              <ShieldAlert className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Sign in required</p>
              <p className="mt-1 text-sm text-muted-brand">
                You need to be signed in to ask questions and post answers.
              </p>
              <Link href="/login"
                className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-white no-underline hover:opacity-90">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      )}

      {userId && profileComplete === false ? (
        <Link
          href="/study/onboarding?next=/study/questions/ask"
          className="flex items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary-light px-4 py-3 text-sm font-semibold text-primary-text no-underline hover:bg-primary/10 dark:border-primary/30 dark:bg-primary/10 dark:text-indigo-200"
        >
          <span>Complete your academic profile so questions reach your courses first.</span>
          <ExternalLink className="h-4 w-4 shrink-0" />
        </Link>
      ) : null}

      {/* All fields in one card — less visual noise */}
      <div className="rounded-2xl border border-border bg-background divide-y divide-border overflow-hidden">

        {/* Title */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium uppercase tracking-widest text-muted-brand">
              Title
            </label>
            <span className={cn("text-xs tabular-nums", titleRemaining < 20 ? "text-rose-600" : "text-muted-brand")}>
              {title.length}/{TITLE_MAX}
            </span>
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. How do I calculate standard deviation in GST101?"
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-brand"
            maxLength={TITLE_MAX}
          />
          {title.length > 0 && (
            <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  titleRemaining < 20 ? "bg-rose-500" : "bg-primary"
                )}
                style={{ width: `${Math.min(100, (title.length / TITLE_MAX) * 100)}%` }}
              />
            </div>
          )}
        </div>

        {title.trim().length >= 15 && (similarLoading || similarQuestions.length > 0) && (
          <div className="rounded-2xl border-t border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-brand" />
              <p className="text-xs font-semibold text-muted-brand">
                Similar questions already asked
              </p>
              {similarLoading && (
                <Loader2 className="ml-auto h-3 w-3 animate-spin text-muted-brand" />
              )}
            </div>

            {similarQuestions.length > 0 ? (
              <div className="divide-y divide-border">
                {similarQuestions.map((q) => (
                  <a
                    key={q.id}
                    href={`/study/questions/${encodeURIComponent(q.id)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "flex items-start justify-between gap-3 px-4 py-3",
                      "no-underline transition hover:bg-secondary/30"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground line-clamp-2">
                        {q.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {q.course_code && (
                          <span className="text-[10px] text-muted-brand">
                            {q.course_code}
                          </span>
                        )}
                        {q.solved ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                            style={{ background: "#EAF3DE", color: "#3B6D11" }}
                          >
                            Solved
                          </span>
                        ) : q.answers_count && q.answers_count > 0 ? (
                          <span className="text-[10px] text-muted-brand">
                            {q.answers_count} answer{q.answers_count !== 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-brand">
                            Unanswered
                          </span>
                        )}
                      </div>
                    </div>
                    <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-brand" />
                  </a>
                ))}
              </div>
            ) : null}

            {similarQuestions.length > 0 && (
              <div className="border-t border-border px-4 py-2.5">
                <p className="text-[11px] text-muted-brand">
                  Check these first — your question may already be answered. You can still post if yours is different.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Course + Level side by side */}
        <div className="grid grid-cols-2 divide-x divide-border">
          <div className="p-4">
            <label className="block text-xs font-medium uppercase tracking-widest text-muted-brand mb-2">
              Course
            </label>
            <input
              value={course}
              onChange={(e) => setCourse(e.target.value.toUpperCase())}
              placeholder="GST101"
              list="study-question-course-options"
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-brand"
            />
            <datalist id="study-question-course-options">
              {courseOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.title ?? option.code}
                </option>
              ))}
            </datalist>
            <p className="mt-1 text-[10px] text-muted-brand">Optional</p>
          </div>
          <div className="p-4">
            <label className="block text-xs font-medium uppercase tracking-widest text-muted-brand mb-2">
              Level
            </label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full bg-transparent text-sm text-foreground outline-none"
            >
              <option value="">—</option>
              {LEVELS.map((lv) => (
                <option key={lv} value={lv}>{lv}L</option>
              ))}
            </select>
          </div>
        </div>

        {/* Details */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium uppercase tracking-widest text-muted-brand">
              Details
            </label>
            <span className={cn("text-xs tabular-nums", bodyRemaining < 200 ? "text-rose-600" : "text-muted-brand")}>
              {body.length}/{BODY_MAX}
            </span>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Explain what you tried, what you don't understand, and include the exact question if possible."
            className="w-full resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-brand"
            style={{ minHeight: 120 }}
            maxLength={BODY_MAX}
          />
        </div>
      </div>

      {/* Tip — nudges for better questions */}
      <div className="rounded-2xl bg-primary-light px-4 py-3">
        <p className="text-xs leading-relaxed text-primary-text">
          Questions with a course code get 3× more answers. Add context — what did you try, and where did you get stuck?
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        disabled={!canSubmit || loading}
        onClick={submit}
        className={cn(
          "inline-flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-medium text-white transition",
          (!canSubmit || loading) ? "opacity-50 cursor-not-allowed" : "hover:opacity-90",
          "bg-primary"
        )}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {loading ? "Posting…" : "Post question"}
      </button>
    </div>
  );
}

