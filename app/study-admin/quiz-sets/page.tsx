"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type QuizSetRow = {
  id: string;
  title: string | null;
  course_code: string | null;
  level: string | null;
  semester: string | null;
  questions_count: number | null;
  published: boolean;
  difficulty: string | null;
  created_at: string;
};

type NotifyState = "idle" | "loading" | "done" | "error";

export default function QuizSetsAdminPage() {
  const router = useRouter();
  const [sets, setSets] = useState<QuizSetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [notifyState, setNotifyState] = useState<Record<string, NotifyState>>({});
  const [notifyMsg, setNotifyMsg] = useState<Record<string, string>>({});

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) {
        router.replace("/login?next=/study-admin/quiz-sets");
        return;
      }

      const { data, error } = await supabase
        .from("study_quiz_sets")
        .select("id,title,course_code,level,semester,questions_count,published,difficulty,created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setSets((data as QuizSetRow[]) ?? []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load quiz sets.");
    } finally {
      setLoading(false);
    }
  }

  async function handleNotify(setId: string) {
    setNotifyState((s) => ({ ...s, [setId]: "loading" }));
    setNotifyMsg((s) => ({ ...s, [setId]: "" }));

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Not authenticated.");

      const res = await fetch(`/api/study-admin/quiz-sets/${setId}/notify`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();

      if (!res.ok || !json.ok) throw new Error(json.message || "Failed.");

      const msg =
        json.notified === 0
          ? "No matching students found."
          : `Notified ${json.notified} student${json.notified === 1 ? "" : "s"}.`;

      setNotifyState((s) => ({ ...s, [setId]: "done" }));
      setNotifyMsg((s) => ({ ...s, [setId]: msg }));
    } catch (e: any) {
      setNotifyState((s) => ({ ...s, [setId]: "error" }));
      setNotifyMsg((s) => ({ ...s, [setId]: e?.message || "Something went wrong." }));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-foreground">Practice Sets</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Send notifications to enrolled students for any published set.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : err ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {err}
        </div>
      ) : sets.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No quiz sets found.
        </div>
      ) : (
        <div className="space-y-3">
          {sets.map((s) => {
            const state = notifyState[s.id] ?? "idle";
            const msg = notifyMsg[s.id];

            return (
              <div
                key={s.id}
                className="flex items-center gap-4 rounded-2xl border border-border bg-card px-4 py-3.5"
              >
                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {s.course_code && (
                      <span className="rounded-full border border-[#5B35D5]/20 bg-[#EEEDFE] px-2 py-0.5 text-xs font-bold text-[#3B24A8]">
                        {s.course_code}
                      </span>
                    )}
                    {s.level && (
                      <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-semibold text-foreground">
                        {s.level}L
                      </span>
                    )}
                    {s.semester && (
                      <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-semibold text-foreground capitalize">
                        {s.semester} sem
                      </span>
                    )}
                    {!s.published && (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                        Unpublished
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-foreground">
                    {s.title ?? "Untitled set"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.questions_count ?? 0} questions · {s.difficulty ?? "mixed"}
                  </p>
                  {msg && (
                    <p
                      className={cn(
                        "mt-1 text-xs font-medium",
                        state === "error" ? "text-destructive" : "text-emerald-600"
                      )}
                    >
                      {msg}
                    </p>
                  )}
                </div>

                {/* Notify button */}
                <button
                  type="button"
                  disabled={state === "loading" || state === "done"}
                  onClick={() => void handleNotify(s.id)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    state === "done"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 cursor-default"
                      : state === "error"
                        ? "border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10"
                        : "border-[#5B35D5]/20 bg-[#EEEDFE] text-[#3B24A8] hover:bg-[#5B35D5]/20"
                  )}
                >
                  {state === "loading" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : state === "done" ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : state === "error" ? (
                    <BellOff className="h-3.5 w-3.5" />
                  ) : (
                    <Bell className="h-3.5 w-3.5" />
                  )}
                  {state === "loading"
                    ? "Sending…"
                    : state === "done"
                      ? "Sent"
                      : state === "error"
                        ? "Retry"
                        : "Notify"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
