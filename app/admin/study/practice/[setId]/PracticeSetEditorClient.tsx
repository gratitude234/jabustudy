"use client";
import { cn } from "@/lib/utils";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

function normalize(v: string) {
  return v.trim().replace(/\s+/g, " ");
}

type QuizSet = {
  id: string;
  title: string;
  description: string | null;
  course_code: string | null;
  level: string | null;
  time_limit_minutes: number | null;
  questions_count: number | null;
  published: boolean;
  created_at: string;
};

type QuizQuestion = {
  id: string;
  set_id: string;
  prompt: string;
  explanation: string | null;
  position: number | null;
  created_at: string;
};

type QuizOption = {
  id: string;
  question_id: string;
  text: string;
  is_correct: boolean;
  position: number | null;
};

export default function PracticeSetEditorClient({ setId }: { setId: string }) {
  const router = useRouter();
  const isNew = setId === "new";

  const [banner, setBanner] = useState<{ kind: "error" | "success" | "info"; text: string } | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mutating, setMutating] = useState<Record<string, boolean>>({});

  const [setRow, setSetRow] = useState<QuizSet | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [level, setLevel] = useState("");
  const [timeLimit, setTimeLimit] = useState<string>("");
  const [published, setPublished] = useState(false);

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [optionsByQ, setOptionsByQ] = useState<Record<string, QuizOption[]>>({});
  const [expandedQ, setExpandedQ] = useState<Record<string, boolean>>({});

  const computedCount = useMemo(() => questions.length, [questions.length]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setBanner(null);
      try {
        if (isNew) {
          if (!mounted) return;
          setSetRow(null);
          setTitle("");
          setDescription("");
          setCourseCode("");
          setLevel("");
          setTimeLimit("");
          setPublished(false);
          setQuestions([]);
          setOptionsByQ({});
          return;
        }

        const { data: setData, error: setErr } = await supabase
          .from("study_quiz_sets")
          .select("*")
          .eq("id", setId)
          .maybeSingle();
        if (setErr) throw setErr;
        if (!setData) {
          setBanner({ kind: "error", text: "Set not found." });
          return;
        }

        const row = setData as QuizSet;
        if (!mounted) return;
        setSetRow(row);
        setTitle(row.title ?? "");
        setDescription(row.description ?? "");
        setCourseCode(row.course_code ?? "");
        setLevel(row.level ?? "");
        setTimeLimit(row.time_limit_minutes == null ? "" : String(row.time_limit_minutes));
        setPublished(!!row.published);

        const { data: qData, error: qErr } = await supabase
          .from("study_quiz_questions")
          .select("*")
          .eq("set_id", setId)
          .order("position", { ascending: true })
          .order("created_at", { ascending: true });
        if (qErr) throw qErr;

        const qs = (qData as QuizQuestion[]) || [];
        setQuestions(qs);

        // load options for all questions
        const ids = qs.map((q) => q.id);
        if (ids.length) {
          const { data: oData, error: oErr } = await supabase
            .from("study_quiz_options")
            .select("*")
            .in("question_id", ids)
            .order("position", { ascending: true });
          if (oErr) throw oErr;
          const map: Record<string, QuizOption[]> = {};
          for (const opt of (oData as QuizOption[]) || []) {
            map[opt.question_id] = map[opt.question_id] || [];
            map[opt.question_id].push(opt);
          }
          setOptionsByQ(map);
        } else {
          setOptionsByQ({});
        }
      } catch (e: any) {
        setBanner({ kind: "error", text: e?.message || "Failed to load CBT set." });
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [setId, isNew]);

  async function saveSet() {
    const payload = {
      title: normalize(title),
      description: normalize(description) || null,
      course_code: normalize(courseCode).toUpperCase() || null,
      level: normalize(level) || null,
      time_limit_minutes: timeLimit.trim() ? Number(timeLimit) : null,
      published,
      questions_count: computedCount,
    };

    if (!payload.title) {
      setBanner({ kind: "error", text: "Title is required." });
      return;
    }

    setSaving(true);
    setBanner(null);
    try {
      if (isNew) {
        const { data, error } = await supabase
          .from("study_quiz_sets")
          .insert(payload)
          .select("*")
          .single();
        if (error) throw error;
        const created = data as QuizSet;
        setBanner({ kind: "success", text: "Set created." });
        router.replace(`/admin/study/practice/${created.id}`);
      } else {
        const { error } = await supabase.from("study_quiz_sets").update(payload).eq("id", setId);
        if (error) throw error;
        setBanner({ kind: "success", text: "Set saved." });
      }
    } catch (e: any) {
      setBanner({ kind: "error", text: e?.message || "Failed to save set." });
    } finally {
      setSaving(false);
    }
  }

  async function addQuestion() {
    if (isNew) {
      setBanner({ kind: "error", text: "Save the set first, then add questions." });
      return;
    }
    setMutating((m) => ({ ...m, addq: true }));
    try {
      const nextPos = questions.length ? (questions[questions.length - 1].position ?? questions.length - 1) + 1 : 0;
      const { data, error } = await supabase
        .from("study_quiz_questions")
        .insert({ set_id: setId, prompt: "New question…", explanation: null, position: nextPos })
        .select("*")
        .single();
      if (error) throw error;
      const q = data as QuizQuestion;
      setQuestions((arr) => [...arr, q]);
      setExpandedQ((s) => ({ ...s, [q.id]: true }));
      // update count
      await supabase.from("study_quiz_sets").update({ questions_count: questions.length + 1 }).eq("id", setId);
    } catch (e: any) {
      setBanner({ kind: "error", text: e?.message || "Failed to add question." });
    } finally {
      setMutating((m) => ({ ...m, addq: false }));
    }
  }

  async function saveQuestion(q: QuizQuestion, patch: Partial<QuizQuestion>) {
    setMutating((m) => ({ ...m, [q.id]: true }));
    try {
      const { error } = await supabase
        .from("study_quiz_questions")
        .update({
          prompt: patch.prompt ?? q.prompt,
          explanation: patch.explanation ?? q.explanation,
          position: patch.position ?? q.position,
        })
        .eq("id", q.id);
      if (error) throw error;
      setQuestions((arr) => arr.map((x) => (x.id === q.id ? { ...x, ...patch } : x)));
    } catch (e: any) {
      setBanner({ kind: "error", text: e?.message || "Failed to save question." });
    } finally {
      setMutating((m) => ({ ...m, [q.id]: false }));
    }
  }

  async function deleteQuestion(q: QuizQuestion) {
    const ok = confirm("Delete this question and its options?");
    if (!ok) return;
    setMutating((m) => ({ ...m, [q.id]: true }));
    try {
      const { error } = await supabase.from("study_quiz_questions").delete().eq("id", q.id);
      if (error) throw error;
      setQuestions((arr) => arr.filter((x) => x.id !== q.id));
      setOptionsByQ((m2) => {
        const copy = { ...m2 };
        delete copy[q.id];
        return copy;
      });
      await supabase.from("study_quiz_sets").update({ questions_count: Math.max(0, questions.length - 1) }).eq("id", setId);
    } catch (e: any) {
      setBanner({ kind: "error", text: e?.message || "Failed to delete question." });
    } finally {
      setMutating((m) => ({ ...m, [q.id]: false }));
    }
  }

  async function addOption(questionId: string) {
    setMutating((m) => ({ ...m, [`addopt_${questionId}`]: true }));
    try {
      const list = optionsByQ[questionId] || [];
      const nextPos = list.length ? (list[list.length - 1].position ?? list.length - 1) + 1 : 0;
      const { data, error } = await supabase
        .from("study_quiz_options")
        .insert({ question_id: questionId, text: "Option…", is_correct: false, position: nextPos })
        .select("*")
        .single();
      if (error) throw error;
      const opt = data as QuizOption;
      setOptionsByQ((m2) => ({ ...m2, [questionId]: [...(m2[questionId] || []), opt] }));
    } catch (e: any) {
      setBanner({ kind: "error", text: e?.message || "Failed to add option." });
    } finally {
      setMutating((m) => ({ ...m, [`addopt_${questionId}`]: false }));
    }
  }

  async function saveOption(questionId: string, opt: QuizOption, patch: Partial<QuizOption>) {
    setMutating((m) => ({ ...m, [opt.id]: true }));
    try {
      // enforce single correct option
      if (patch.is_correct) {
        await supabase.from("study_quiz_options").update({ is_correct: false }).eq("question_id", questionId);
      }
      const { error } = await supabase
        .from("study_quiz_options")
        .update({
          text: patch.text ?? opt.text,
          is_correct: patch.is_correct ?? opt.is_correct,
          position: patch.position ?? opt.position,
        })
        .eq("id", opt.id);
      if (error) throw error;

      setOptionsByQ((m2) => {
        const arr = (m2[questionId] || []).map((x) => (x.id === opt.id ? { ...x, ...patch } : x));
        // if we set correct, reflect in local state
        if (patch.is_correct) {
          for (const a of arr) {
            if (a.id !== opt.id) a.is_correct = false;
          }
        }
        return { ...m2, [questionId]: arr };
      });
    } catch (e: any) {
      setBanner({ kind: "error", text: e?.message || "Failed to save option." });
    } finally {
      setMutating((m) => ({ ...m, [opt.id]: false }));
    }
  }

  async function deleteOption(questionId: string, opt: QuizOption) {
    const ok = confirm("Delete this option?");
    if (!ok) return;
    setMutating((m) => ({ ...m, [opt.id]: true }));
    try {
      const { error } = await supabase.from("study_quiz_options").delete().eq("id", opt.id);
      if (error) throw error;
      setOptionsByQ((m2) => ({ ...m2, [questionId]: (m2[questionId] || []).filter((x) => x.id !== opt.id) }));
    } catch (e: any) {
      setBanner({ kind: "error", text: e?.message || "Failed to delete option." });
    } finally {
      setMutating((m) => ({ ...m, [opt.id]: false }));
    }
  }

  function moveQuestion(q: QuizQuestion, dir: -1 | 1) {
    const idx = questions.findIndex((x) => x.id === q.id);
    const nextIdx = idx + dir;
    if (idx < 0 || nextIdx < 0 || nextIdx >= questions.length) return;
    const other = questions[nextIdx];
    // swap positions locally and persist
    const aPos = q.position ?? idx;
    const bPos = other.position ?? nextIdx;
    saveQuestion(q, { position: bPos });
    saveQuestion(other, { position: aPos });
    // optimistic reorder
    const copy = [...questions];
    copy[idx] = { ...q, position: bPos };
    copy[nextIdx] = { ...other, position: aPos };
    copy.sort((x, y) => (x.position ?? 0) - (y.position ?? 0));
    setQuestions(copy);
  }

  return (
    <div className="space-y-4 pb-28 md:pb-6">
      <header className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
        <Link
          href="/admin/study?tab=practice"
          className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-900 no-underline hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to CBT sets
        </Link>

        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-zinc-900">{isNew ? "New CBT set" : "Edit CBT set"}</p>
            <p className="text-sm text-zinc-600">Build a question set for Practice Mode.</p>
          </div>

          <button
            type="button"
            onClick={saveSet}
            disabled={saving || loading}
            className={cn(
              "inline-flex items-center gap-2 rounded-2xl border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800",
              saving || loading ? "opacity-70" : ""
            )}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save set
          </button>
        </div>

        {banner ? (
          <div
            className={cn(
              "mt-3 rounded-2xl border p-3 text-sm",
              banner.kind === "error" && "border-red-200 bg-red-50 text-red-800",
              banner.kind === "success" && "border-emerald-200 bg-emerald-50 text-emerald-900",
              banner.kind === "info" && "border-blue-200 bg-blue-50 text-blue-900"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold">{banner.text}</p>
              <button type="button" onClick={() => setBanner(null)} className="rounded-xl p-1 hover:bg-white/60">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-3xl border bg-white p-4">
            <label className="text-xs font-semibold text-zinc-700">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2"
              placeholder="e.g., GST101 Practice Set 1"
            />

            <label className="mt-3 block text-xs font-semibold text-zinc-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2"
              rows={3}
              placeholder="Optional description…"
            />
          </div>

          <div className="rounded-3xl border bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-zinc-700">Course code</label>
                <input
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  className="mt-1 w-full rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2"
                  placeholder="GST101"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-700">Level</label>
                <input
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="mt-1 w-full rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2"
                  placeholder="100"
                />
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-zinc-700">Time limit (minutes)</label>
                <input
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(e.target.value)}
                  className="mt-1 w-full rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2"
                  placeholder="e.g., 30"
                  inputMode="numeric"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setPublished((p) => !p)}
                  className={cn(
                    "mt-1 inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold",
                    published
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-zinc-200 bg-zinc-50 text-zinc-800"
                  )}
                >
                  <ShieldCheck className="h-4 w-4" /> {published ? "Published" : "Draft"}
                </button>
              </div>
            </div>

            <p className="mt-3 text-xs text-zinc-600">Questions: <span className="font-semibold text-zinc-900">{computedCount}</span></p>
          </div>
        </div>
      </header>

      <div className="rounded-3xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-zinc-900">Questions</p>
            <p className="text-xs text-zinc-600">Each question should have at least 2 options and one correct answer.</p>
          </div>
          <button
            type="button"
            onClick={addQuestion}
            disabled={!!mutating.addq || loading}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800",
              mutating.addq || loading ? "opacity-60" : ""
            )}
          >
            {mutating.addq ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add question
          </button>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-zinc-600">Loading…</div>
        ) : questions.length ? (
          <div className="mt-4 space-y-3">
            {questions
              .slice()
              .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
              .map((q, idx) => {
                const open = expandedQ[q.id] ?? idx < 1;
                const qBusy = !!mutating[q.id];
                const opts = optionsByQ[q.id] || [];
                const hasCorrect = opts.some((o) => o.is_correct);
                return (
                  <div key={q.id} className="rounded-3xl border bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setExpandedQ((s) => ({ ...s, [q.id]: !open }))}
                        className="flex min-w-0 flex-1 items-start gap-3 text-left"
                      >
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl border bg-zinc-50 text-sm font-bold">
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-zinc-900">{q.prompt || "(empty question)"}</p>
                          <p className="mt-1 text-xs text-zinc-600">
                            Options: {opts.length} {hasCorrect ? "•" : "• Missing correct answer"}
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => moveQuestion(q, -1)}
                          className="grid h-9 w-9 place-items-center rounded-2xl border hover:bg-zinc-50"
                          aria-label="Move up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveQuestion(q, 1)}
                          className="grid h-9 w-9 place-items-center rounded-2xl border hover:bg-zinc-50"
                          aria-label="Move down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteQuestion(q)}
                          disabled={qBusy}
                          className={cn(
                            "inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50",
                            qBusy ? "opacity-60" : ""
                          )}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    </div>

                    {open ? (
                      <div className="mt-4 grid gap-3">
                        <div>
                          <label className="text-xs font-semibold text-zinc-700">Prompt</label>
                          <textarea
                            value={q.prompt}
                            onChange={(e) => setQuestions((arr) => arr.map((x) => (x.id === q.id ? { ...x, prompt: e.target.value } : x)))}
                            className="mt-1 w-full rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2"
                            rows={3}
                          />
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-zinc-700">Explanation (optional)</label>
                          <textarea
                            value={q.explanation ?? ""}
                            onChange={(e) => setQuestions((arr) => arr.map((x) => (x.id === q.id ? { ...x, explanation: e.target.value } : x)))}
                            className="mt-1 w-full rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2"
                            rows={2}
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => saveQuestion(q, { prompt: q.prompt, explanation: q.explanation ?? null })}
                            disabled={qBusy}
                            className={cn(
                              "inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50",
                              qBusy ? "opacity-60" : ""
                            )}
                          >
                            {qBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Save question
                          </button>

                          {hasCorrect ? (
                            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                              <Check className="h-4 w-4" /> Correct answer set
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
                              Pick one correct option
                            </span>
                          )}
                        </div>

                        <div className="rounded-3xl border bg-zinc-50 p-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm font-semibold text-zinc-900">Options</p>
                            <button
                              type="button"
                              onClick={() => addOption(q.id)}
                              disabled={!!mutating[`addopt_${q.id}`]}
                              className={cn(
                                "inline-flex items-center justify-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50",
                                mutating[`addopt_${q.id}`] ? "opacity-60" : ""
                              )}
                            >
                              {mutating[`addopt_${q.id}`] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                              Add option
                            </button>
                          </div>

                          <div className="mt-3 space-y-2">
                            {(opts.length ? opts : []).map((o, oIdx) => {
                              const oBusy = !!mutating[o.id];
                              return (
                                <div key={o.id} className="flex flex-col gap-2 rounded-2xl border bg-white p-3 sm:flex-row sm:items-center">
                                  <div className="flex items-center gap-3 sm:flex-1">
                                    <div className="grid h-8 w-8 place-items-center rounded-xl border bg-zinc-50 text-xs font-bold">
                                      {String.fromCharCode(65 + oIdx)}
                                    </div>
                                    <input
                                      value={o.text}
                                      onChange={(e) =>
                                        setOptionsByQ((m2) => ({
                                          ...m2,
                                          [q.id]: (m2[q.id] || []).map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)),
                                        }))
                                      }
                                      className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
                                    />
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => saveOption(q.id, o, { text: o.text })}
                                      disabled={oBusy}
                                      className={cn(
                                        "inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50",
                                        oBusy ? "opacity-60" : ""
                                      )}
                                    >
                                      {oBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                      Save
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => saveOption(q.id, o, { is_correct: true })}
                                      disabled={oBusy}
                                      className={cn(
                                        "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold",
                                        o.is_correct
                                          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                                          : "border-zinc-200 bg-white hover:bg-zinc-50",
                                        oBusy ? "opacity-60" : ""
                                      )}
                                    >
                                      {o.is_correct ? <Check className="h-4 w-4" /> : null}
                                      {o.is_correct ? "Correct" : "Mark correct"}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => deleteOption(q.id, o)}
                                      disabled={oBusy}
                                      className={cn(
                                        "inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50",
                                        oBusy ? "opacity-60" : ""
                                      )}
                                    >
                                      <Trash2 className="h-4 w-4" /> Delete
                                    </button>
                                  </div>
                                </div>
                              );
                            })}

                            {opts.length === 0 ? <p className="text-sm text-zinc-600">No options yet. Add at least 2.</p> : null}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border bg-zinc-50 p-6 text-center text-sm text-zinc-600">
            No questions yet. Click “Add question”.
          </div>
        )}
      </div>

      <div className="rounded-3xl border bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-zinc-900">Quick links</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {!isNew && setRow ? (
            <Link
              href={`/study/practice/${setRow.id}`}
              className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
            >
              <ExternalLinkIcon /> Preview as student
            </Link>
          ) : null}
          <Link
            href="/admin/study?tab=practice"
            className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
          >
            Back to sets
          </Link>
        </div>
      </div>
    </div>
  );
}

function ExternalLinkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 3h7v7" />
      <path d="M10 14L21 3" />
      <path d="M21 14v7H3V3h7" />
    </svg>
  );
}
