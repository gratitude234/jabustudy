"use client";
// app/study/questions/[id]/QuestionDetailClient.tsx
import { cn, formatWhen } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  ArrowRight,
  AlertTriangle, CheckCircle2, Flag,
  BookOpen,
  Loader2, RotateCcw, Send,
  Sparkles, ThumbsUp, Zap,
} from "lucide-react";

const AI_AUTHOR_EMAIL = "ai@jabustudy.app";
const LEGACY_AI_AUTHOR_EMAIL = "ai@" + "jabu" + "market.app";

function isAiAuthor(email: string | null | undefined) {
  return email === AI_AUTHOR_EMAIL || email === LEGACY_AI_AUTHOR_EMAIL;
}

function maskEmail(email: string | null | undefined): string {
  if (!email) return "Anonymous";
  if (isAiAuthor(email)) return "AI · Gemini";
  return (email.split("@")[0] ?? email).replace(/[._]/g, " ");
}

type QuestionRow = {
  id: string; title: string; body: string | null;
  course_code: string | null; level: string | null;
  created_at: string | null; answers_count: number | null;
  upvotes_count: number | null; solved: boolean | null;
  author_email: string | null; author_id: string | null;
};

type AnswerRow = {
  id: string; question_id: string; body: string;
  created_at: string | null; author_email: string | null;
  author_id: string | null; is_accepted: boolean | null;
  upvotes_count?: number | null; is_ai?: boolean | null;
};

type CourseResources = {
  materials: Array<{ id: string; title: string | null; material_type: string | null; downloads: number | null }>;
  practiceSets: Array<{ id: string; title: string | null; questions_count: number | null }>;
};

type MaterialResourceRow = {
  id: string;
  title: string | null;
  material_type: string | null;
  downloads: number | null;
};

type PracticeSetResourceRow = {
  id: string;
  title: string | null;
  questions_count: number | null;
};

function QuestionSkeleton() {
  return (
    <div className="space-y-4">
      <div className="animate-pulse rounded-2xl border border-border bg-background p-5 space-y-3">
        <div className="flex gap-2"><div className="h-5 w-14 rounded-full bg-muted" /><div className="h-5 w-20 rounded-full bg-muted" /></div>
        <div className="h-5 w-3/4 rounded bg-muted" />
        <div className="h-4 w-full rounded bg-muted" /><div className="h-4 w-5/6 rounded bg-muted" />
      </div>
      <div className="animate-pulse rounded-2xl border border-border bg-background p-5 space-y-3">
        <div className="h-4 w-20 rounded bg-muted" />
        {[1,2].map((i) => (
          <div key={i} className="rounded-2xl border border-border p-3 space-y-2">
            <div className="h-4 w-full rounded bg-muted" /><div className="h-4 w-4/5 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

type AiState = { status: "idle" } | { status: "loading" } | { status: "done" } | { status: "error"; message: string };

function AiAnswerButton({ questionId, title, questionBody, courseCode, level, compact, onAnswerAdded }: {
  questionId: string; title: string; questionBody: string | null;
  courseCode: string | null; level: string | null;
  compact?: boolean; onAnswerAdded: (answer: AnswerRow) => void;
}) {
  const [state, setState] = useState<AiState>({ status: "idle" });

  async function askAi() {
    setState({ status: "loading" });
    try {
      const res  = await fetch("/api/ai/qa-answer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, title, questionBody, courseCode, level }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setState({ status: "error", message: json.error ?? "Something went wrong." });
      } else {
        const a = json.answer;
        setState({ status: "done" });
        onAnswerAdded({
          id: a.id ?? `ai-${Date.now()}`, question_id: questionId,
          body: a.body, created_at: a.created_at ?? new Date().toISOString(),
          author_email: AI_AUTHOR_EMAIL, author_id: null, is_accepted: false, is_ai: true,
        });
      }
    } catch { setState({ status: "error", message: "Network error. Please try again." }); }
  }

  if (state.status === "done") return null;

  if (state.status === "loading") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary-light px-3 py-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary">
          <Loader2 className="h-4 w-4 animate-spin text-white" />
        </span>
        <div>
          <p className="text-xs font-medium text-primary-text">Generating AI answer…</p>
          <p className="text-[11px] text-primary/70">Powered by Gemini</p>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex items-start gap-2 rounded-2xl border border-rose-200/60 bg-rose-50/60 px-3 py-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-rose-700">{state.message}</p>
        </div>
        <button type="button" onClick={askAi}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-xl border border-rose-200/60 bg-background text-rose-600 hover:bg-rose-50">
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (compact) {
    return (
      <button type="button" onClick={askAi}
        className="flex w-full items-center gap-2 rounded-2xl border border-primary/30 bg-primary-light px-3 py-2 text-left hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Zap className="h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs font-medium text-primary-text">Also get an AI take</p>
        <Sparkles className="ml-auto h-3.5 w-3.5 shrink-0 text-primary" />
      </button>
    );
  }

  return (
    <button type="button" onClick={askAi}
      className="flex w-full items-center gap-3 rounded-2xl border border-primary/30 bg-primary-light px-3 py-3 text-left hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary">
        <Zap className="h-4 w-4 text-white" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-primary-text">Get an AI answer</p>
        <p className="text-[11px] text-primary/70">No human answers yet — ask Gemini for a starting point</p>
      </div>
      <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
    </button>
  );
}

function AnswerUpvoteButton({ answerId, initialCount, meId, onError }: {
  answerId: string; initialCount: number; meId: string | null; onError: (msg: string) => void;
}) {
  const [count,   setCount]   = useState(initialCount);
  const [voted,   setVoted]   = useState(false);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (!meId) { onError("Please sign in to upvote."); return; }
    if (loading) return;
    const wasVoted = voted;
    setCount((c) => wasVoted ? Math.max(0, c - 1) : c + 1);
    setVoted(!wasVoted);
    setLoading(true);
    try {
      const res  = await fetch(`/api/study/answers/${answerId}/upvote`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed.");
      setCount(json.count); setVoted(json.upvoted);
    } catch (e: any) {
      setCount((c) => wasVoted ? c + 1 : Math.max(0, c - 1));
      setVoted(wasVoted);
      onError(e?.message ?? "Failed to vote.");
    } finally { setLoading(false); }
  }

  return (
    <button type="button" onClick={toggle} disabled={loading}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-colors",
        voted ? "border-primary/25 bg-primary-light text-primary-text" : "border-border bg-background text-foreground hover:bg-secondary/60",
        loading && "opacity-60 cursor-not-allowed"
      )}>
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsUp className="h-3 w-3" />}
      {count > 0 && <span>{count}</span>}
    </button>
  );
}

export default function QuestionDetailClient({ id }: { id: string }) {
  const [meId,     setMeId]     = useState<string | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [question, setQuestion] = useState<QuestionRow | null>(null);
  const [answers,  setAnswers]  = useState<AnswerRow[]>([]);
  const [courseResources, setCourseResources] = useState<CourseResources | null>(null);

  const [myVoteLoading, setMyVoteLoading] = useState(false);
  const [myUpvoted,     setMyUpvoted]     = useState(false);

  const ANSWER_MAX = 2000;
  const [answerBody, setAnswerBody] = useState("");
  const [posting,    setPosting]    = useState(false);
  const [postError,  setPostError]  = useState<string | null>(null);
  const [expanded,   setExpanded]   = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const loadSeqRef = useRef(0);

  const isMyQuestion     = meId != null && question?.author_id === meId;
  const humanAnswerCount = answers.filter((a) => !a.is_ai && !isAiAuthor(a.author_email)).length;
  const hasAiAnswer      = answers.some((a) => a.is_ai || isAiAuthor(a.author_email));

  const canAnswer = useMemo(() => {
    if (!meId) return false;
    const len = answerBody.trim().length;
    return len >= 10 && len <= ANSWER_MAX;
  }, [meId, answerBody]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setMeId(data?.user?.id ?? null);
    })();
  }, []);

  useEffect(() => {
    document.body.setAttribute("data-hide-nav", "true");
    return () => {
      document.body.removeAttribute("data-hide-nav");
    };
  }, []);

  async function load() {
    const loadSeq = ++loadSeqRef.current;
    setLoading(true); setError(null);
    setCourseResources(null);
    setMyUpvoted(false);
    try {
      const q = await supabase
        .from("study_questions")
        .select("id,title,body,course_code,level,created_at,answers_count,upvotes_count,solved,author_email,author_id")
        .eq("id", id).single();
      if (q.error) throw q.error;
      if (loadSeq !== loadSeqRef.current) return;
      setQuestion(q.data as any);

      const a = await supabase
        .from("study_answers")
        .select("id,question_id,body,created_at,author_email,author_id,is_accepted,upvotes_count,is_ai")
        .eq("question_id", id)
        .order("is_accepted",   { ascending: false })
        .order("upvotes_count", { ascending: false, nullsFirst: false })
        .order("created_at",    { ascending: true });
      if (a.error) throw a.error;
      if (loadSeq !== loadSeqRef.current) return;
      setAnswers((a.data as any) ?? []);

      if (q.data?.course_code) {
        const code = q.data.course_code;
        Promise.all([
          // Assumption: study_materials is keyed by course_id, so filter via study_courses join.
          supabase
            .from("study_materials")
            .select("id,title,material_type,downloads,study_courses!inner(course_code)")
            .eq("approved", true)
            .eq("study_courses.course_code", code)
            .order("downloads", { ascending: false, nullsFirst: false })
            .limit(3),
          supabase
            .from("study_quiz_sets")
            .select("id,title,questions_count")
            .eq("published", true)
            .ilike("course_code", code)
            .order("created_at", { ascending: false })
            .limit(2),
        ]).then(([matRes, setRes]) => {
          if (loadSeq !== loadSeqRef.current) return;

          const materials = ((matRes.data ?? []) as Array<MaterialResourceRow & {
            study_courses?: { course_code: string | null } | Array<{ course_code: string | null }> | null;
          }>).map((m) => ({
            id: m.id,
            title: m.title,
            material_type: m.material_type,
            downloads: m.downloads,
          }));
          const practiceSets = (setRes.data ?? []) as PracticeSetResourceRow[];

          if (materials.length > 0 || practiceSets.length > 0) {
            setCourseResources({ materials, practiceSets });
          }
        }).catch(() => {
          // non-critical, swallow silently
        });
      }

      const { data: u } = await supabase.auth.getUser();
      if (u?.user?.id) {
        const v = await supabase.from("study_question_votes")
          .select("id").eq("question_id", id).eq("voter_id", u.user.id).maybeSingle();
        if (loadSeq !== loadSeqRef.current) return;
        setMyUpvoted(!!v.data);
      }
    } catch (e: any) {
      if (loadSeq !== loadSeqRef.current) return;
      setError(e?.message ?? "Failed to load question.");
    } finally {
      if (loadSeq === loadSeqRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, meId]);

  async function toggleUpvote() {
    setPostError(null);
    if (!meId) { setPostError("Please sign in to upvote."); return; }
    if (!question || myVoteLoading) return;
    const optimistic = myUpvoted ? Math.max(0, (question.upvotes_count ?? 0) - 1) : (question.upvotes_count ?? 0) + 1;
    setQuestion({ ...question, upvotes_count: optimistic });
    setMyUpvoted(!myUpvoted);
    setMyVoteLoading(true);
    try {
      const res  = await fetch(`/api/study/questions/${id}/upvote`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed.");
      setQuestion((q) => q ? { ...q, upvotes_count: json.count } : q);
      setMyUpvoted(json.upvoted);
    } catch (e: any) {
      setQuestion({ ...question, upvotes_count: question.upvotes_count });
      setMyUpvoted(myUpvoted);
      setPostError(e?.message ?? "Failed.");
    } finally { setMyVoteLoading(false); }
  }

  async function postAnswer() {
    setPostError(null);
    if (!meId) { setPostError("Please sign in to answer."); return; }
    const b = answerBody.trim();
    if (b.length < 10 || b.length > ANSWER_MAX) return;
    setPosting(true);
    try {
      const res  = await fetch("/api/study/answers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: id, body: b }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to post.");
      setAnswers((prev) => [...prev, json.answer as any]);
      setAnswerBody(""); setExpanded(false);
      setQuestion((q) => q ? { ...q, answers_count: (q.answers_count ?? 0) + 1 } : q);
    } catch (e: any) {
      setPostError(e?.message ?? "Failed to post answer.");
    } finally { setPosting(false); }
  }

  async function acceptAnswer(answerId: string) {
    setPostError(null);
    if (!question || !isMyQuestion) { setPostError("Only the question owner can accept an answer."); return; }
    try {
      const res  = await fetch(`/api/study/answers/${answerId}/accept`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: id }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed.");
      setQuestion({ ...question, solved: true });
      setAnswers((prev) =>
        prev.map((a) => ({ ...a, is_accepted: a.id === answerId }))
          .sort((a, b) => Number(!!b.is_accepted) - Number(!!a.is_accepted))
      );
    } catch (e: any) { setPostError(e?.message ?? "Failed."); }
  }

  return (
    <div
      data-hide-nav="true"
      className={cn(
        "space-y-4",
        expanded ? "pb-72 md:pb-64" : "pb-32 md:pb-28"
      )}
    >


      {loading ? <QuestionSkeleton /> : error ? (
        <div className="rounded-2xl border border-border bg-background p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-medium text-foreground">Couldn't load question</p>
              <p className="mt-1 text-sm text-muted-brand">{error}</p>
              <button type="button" onClick={load}
                className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-border bg-secondary px-4 py-2.5 text-sm font-medium text-foreground hover:opacity-90">
                <RotateCcw className="h-4 w-4" /> Try again
              </button>
            </div>
          </div>
        </div>
      ) : question ? (
        <>
          {/* Question card */}
          <div className="rounded-2xl border border-border bg-background p-5">
            <div className="flex flex-wrap items-center gap-2">
              {question.solved ? (
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{ background: "#EAF3DE", color: "#3B6D11" }}>
                  <CheckCircle2 className="h-3 w-3" /> Solved
                </span>
              ) : (
                <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-brand">Open</span>
              )}
              {isMyQuestion && (
                <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-brand">
                  Your question
                </span>
              )}
            </div>

            <h1 className="mt-3 font-[family-name:var(--font-bricolage)] text-base font-medium leading-snug text-foreground">{question.title}</h1>
            {question.body && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-brand">{question.body}</p>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-muted-brand">
                By <span className="font-medium capitalize text-foreground">{maskEmail(question.author_email)}</span>
                {" · "}{formatWhen(question.created_at)}
              </span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={toggleUpvote} disabled={myVoteLoading}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-medium transition-colors",
                    myUpvoted ? "border-primary/25 bg-primary-light text-primary-text" : "border-border bg-background text-foreground hover:bg-secondary/60",
                    myVoteLoading && "opacity-70"
                  )}>
                  {myVoteLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5" />}
                  {question.upvotes_count ?? 0}
                </button>
                <Link href={`/study/report?question=${encodeURIComponent(question.id)}`}
                  className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground no-underline hover:bg-secondary/50">
                  <Flag className="h-3.5 w-3.5" /> Report
                </Link>
              </div>
            </div>
          </div>

          {/* Answers card */}
          <div className="rounded-2xl border border-border bg-background p-5">
            <p className="text-sm font-medium text-foreground">
              Answers
              {answers.length > 0 && (
                <span className="ml-2 rounded-full border border-border bg-secondary px-2 py-0.5 text-xs text-muted-brand">
                  {humanAnswerCount}{hasAiAnswer ? " + AI" : ""}
                </span>
              )}
            </p>

            <div className="mt-4 space-y-3">
              {answers.length === 0 ? (
                <>
                  <p className="text-sm text-muted-brand">No answers yet. Be the first to help.</p>
                  {question && (
                    <AiAnswerButton questionId={question.id} title={question.title}
                      questionBody={question.body} courseCode={question.course_code}
                      level={question.level} onAnswerAdded={(a) => setAnswers([a])} />
                  )}
                </>
              ) : (
                <>
                  {answers.map((a) => {
                    const isAi = !!(a.is_ai || isAiAuthor(a.author_email));
                    return a.is_accepted ? (
                      /* Accepted answer — pinned visual with teal banner header */
                      <div key={a.id} className="overflow-hidden rounded-2xl border border-teal-300/50 dark:border-teal-700/40">
                        {/* Banner */}
                        <div className="flex items-center gap-2 border-b border-teal-200/60 bg-[#E1F5EE] px-4 py-2.5 dark:border-teal-700/30 dark:bg-teal-950/30">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#1D9E75]" />
                          <span className="text-xs font-bold text-[#085041] dark:text-teal-300">
                            Accepted answer
                          </span>
                        </div>
                        {/* Answer body */}
                        <div className="bg-card p-4">
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{a.body}</p>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs text-muted-brand">
                              <span className="font-medium capitalize text-foreground">{maskEmail(a.author_email)}</span>
                              {" · "}{formatWhen(a.created_at)}
                            </span>
                            <AnswerUpvoteButton
                              answerId={a.id}
                              initialCount={a.upvotes_count ?? 0}
                              meId={meId}
                              onError={(msg) => setPostError(msg)}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Regular or AI answer */
                      <div key={a.id} className={cn("rounded-2xl border p-4", isAi && "border-primary/30 bg-primary-light")}>
                        {isAi && (
                          <div className="mb-2 flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-white">
                              <Sparkles className="h-2.5 w-2.5" /> AI · Gemini
                            </span>
                            <span className="text-[10px] text-primary/70">Verify before your exam</span>
                          </div>
                        )}
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{a.body}</p>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs text-muted-brand">
                            {isAi ? (
                              <span className="text-primary-text">{maskEmail(a.author_email)}</span>
                            ) : (
                              <>
                                <span className="font-medium capitalize text-foreground">{maskEmail(a.author_email)}</span>
                                {" · "}{formatWhen(a.created_at)}
                              </>
                            )}
                          </span>
                          <div className="flex items-center gap-2">
                            {isMyQuestion && !a.is_accepted && (
                              <button type="button" onClick={() => acceptAnswer(a.id)}
                                className="inline-flex items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/60"
                                style={{ borderColor: "#97C459" }}>
                                <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "#1D9E75" }} /> Accept
                              </button>
                            )}
                            {!isAi && (
                              <AnswerUpvoteButton
                                answerId={a.id}
                                initialCount={a.upvotes_count ?? 0}
                                meId={meId}
                                onError={(msg) => setPostError(msg)}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {!hasAiAnswer && question && (
                    <AiAnswerButton questionId={question.id} title={question.title}
                      questionBody={question.body} courseCode={question.course_code}
                      level={question.level} compact
                      onAnswerAdded={(a) => setAnswers((prev) => [...prev, a])} />
                  )}
                </>
              )}
            </div>
          </div>

          {postError && (
            <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{postError}
            </div>
          )}

          {courseResources && question?.course_code && (
            <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-extrabold text-foreground">
                  What else can help?
                </p>
                <p className="mt-0.5 text-xs text-muted-brand">
                  Resources for {question.course_code}
                </p>
              </div>

              {courseResources.materials.length > 0 && (
                <div className="border-b border-border px-4 py-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-brand">
                    Study materials
                  </p>
                  <div className="space-y-2">
                    {courseResources.materials.map((m) => (
                      <Link
                        key={m.id}
                        href={`/study/materials/${encodeURIComponent(m.id)}`}
                        className={cn(
                          "flex items-center gap-3 rounded-2xl border border-border",
                          "bg-background px-3 py-2.5 no-underline transition",
                          "hover:bg-secondary/30",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        )}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary-light dark:bg-primary/10">
                          <BookOpen className="h-3.5 w-3.5 text-primary dark:text-indigo-300" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {m.title ?? "Material"}
                          </p>
                          {m.downloads != null && (
                            <p className="text-xs text-muted-brand">
                              {m.downloads.toLocaleString()} downloads
                            </p>
                          )}
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-brand" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {courseResources.practiceSets.length > 0 && (
                <div className="px-4 py-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-brand">
                    Practice sets
                  </p>
                  <div className="space-y-2">
                    {courseResources.practiceSets.map((s) => (
                      <Link
                        key={s.id}
                        href={`/study/practice/${encodeURIComponent(s.id)}`}
                        className={cn(
                          "flex items-center gap-3 rounded-2xl border border-border",
                          "bg-background px-3 py-2.5 no-underline transition",
                          "hover:bg-secondary/30",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        )}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary-light dark:bg-primary/10">
                          <Zap className="h-3.5 w-3.5 text-primary dark:text-indigo-300" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {s.title ?? "Practice set"}
                          </p>
                          {s.questions_count != null && (
                            <p className="text-xs text-muted-brand">
                              {s.questions_count} question{s.questions_count !== 1 ? "s" : ""}
                            </p>
                          )}
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-brand" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : null}

      {/* ── Sticky compose bar — always accessible, no scrolling needed ── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto w-full max-w-6xl">
        {!meId ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3">
            <p className="text-sm text-muted-brand">Sign in to post an answer</p>
            <Link href="/login"
              className="inline-flex items-center rounded-2xl bg-primary px-3 py-2 text-sm font-medium text-white no-underline">
              Sign in
            </Link>
          </div>
        ) : expanded ? (
          <div className="space-y-2">
            <textarea
              ref={textareaRef}
              value={answerBody}
              onChange={(e) => setAnswerBody(e.target.value)}
              placeholder="Write your answer… (min 10 characters)"
              maxLength={ANSWER_MAX}
              rows={4}
              className="w-full resize-none rounded-2xl border border-border bg-background p-3 text-sm text-foreground outline-none placeholder:text-muted-brand focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
            />
            <div className="flex items-center justify-between gap-2">
              <span className={cn("text-xs tabular-nums", answerBody.length > ANSWER_MAX - 100 ? "text-rose-600" : "text-muted-brand")}>
                {answerBody.length}/{ANSWER_MAX}
              </span>
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => { setExpanded(false); setAnswerBody(""); setPostError(null); }}
                  className="rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary/50">
                  Cancel
                </button>
                <button type="button" onClick={postAnswer} disabled={!canAnswer || posting}
                  className={cn("inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition", (!canAnswer || posting) ? "opacity-50" : "hover:opacity-90")}>
                  {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Post answer
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button type="button"
            onClick={() => { setExpanded(true); setTimeout(() => textareaRef.current?.focus(), 50); }}
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-left hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary">
              <Send className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm text-muted-brand">Write an answer…</span>
          </button>
        )}
        </div>
      </div>
    </div>
  );
}
