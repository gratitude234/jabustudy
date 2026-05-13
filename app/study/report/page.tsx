"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

const REASONS = [
  "Copyright / plagiarism",
  "Wrong course / mislabeled",
  "Spam / duplicate",
  "Inappropriate",
  "Scam / suspicious",
  "Other",
] as const;

function StudyReportInner() {
  const sp = useSearchParams();
  const router = useRouter();

  const materialId = (sp.get("material") ?? "").trim();
  const tutorId = (sp.get("tutor") ?? "").trim();
  const questionId = (sp.get("question") ?? "").trim();
  const answerId = (sp.get("answer") ?? "").trim();

  const target: "material" | "tutor" | "question" | "answer" = tutorId
    ? "tutor"
    : materialId
      ? "material"
      : answerId
        ? "answer"
        : "question";

  const [reason, setReason] = useState<(typeof REASONS)[number]>("Spam / duplicate");
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(
    () => Boolean((materialId || tutorId || questionId || answerId) && reason),
    [materialId, tutorId, questionId, answerId, reason]
  );

  useEffect(() => {
    // If user is logged in, prefill email
    (async () => {
      const { data } = await supabase.auth.getUser();
      const userEmail = data.user?.email ?? "";
      if (userEmail) setEmail(userEmail);
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!materialId && !tutorId && !questionId && !answerId) {
      setMsg("Missing report target. Go back and try again.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("study_reports").insert({
      material_id: materialId || null,
      tutor_id: tutorId || null,
      question_id: questionId || null,
      answer_id: answerId || null,
      reason,
      details: details.trim() || null,
      reporter_email: email.trim() || null,
      status: "open",
    });
    setLoading(false);

    if (error) {
      setMsg(
        error.message.includes("relation") || error.message.includes("does not exist")
          ? "Reports database isn’t set up yet (study_reports table missing). Create the table in Supabase, then this will work."
          : error.message
      );
      return;
    }

    setMsg("Report submitted ✅ Thanks for helping keep Jabu Study safe.");
    setTimeout(() => {
      if (target === "tutor") return router.push("/study/tutors");
      if (target === "material") return router.push("/study/library");
      return router.push("/study/questions");
    }, 900);
  }

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">
          Report {target === "tutor" ? "Tutor" : target === "material" ? "Study Material" : target === "answer" ? "Answer" : "Question"}
        </h1>
        <p className="text-sm text-zinc-600">Please tell us what’s wrong. We’ll review it.</p>
      </div>

      {msg ? <div className="rounded-2xl border bg-white p-4 text-sm">{msg}</div> : null}

      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-2xl border bg-white p-4 space-y-3">
          <div>
            <label className="text-xs text-zinc-600">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as any)}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-zinc-600">More details (optional)</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              placeholder="What happened? Any proof?"
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-600">Your email (optional)</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="you@school.com"
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          disabled={!canSubmit || loading}
          className="w-full rounded-2xl bg-black px-4 py-3 text-white font-medium disabled:opacity-60"
        >
          {loading ? "Submitting..." : "Submit report"}
        </button>

        <button type="button" onClick={() => router.back()} className="w-full rounded-2xl border px-4 py-3 text-sm">
          Cancel
        </button>
      </form>
    </div>
  );
}

export default function StudyReportPage() {
  return (
    <Suspense fallback={null}>
      <StudyReportInner />
    </Suspense>
  );
}
