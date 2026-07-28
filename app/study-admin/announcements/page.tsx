"use client";
// app/study-admin/announcements/page.tsx
//
// Compose an announcement, preview how it will actually appear in a phone's
// notification tray, send a test to yourself, then broadcast.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BellRing,
  Calculator,
  Check,
  Clock,
  Loader2,
  Megaphone,
  Send,
  SendHorizonal,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  ANNOUNCEMENT_BODY_MAX,
  ANNOUNCEMENT_TITLE_MAX,
  PUSH_BODY_VISIBLE_HINT,
} from "@/lib/announcementLimits";

type AnnouncementStatus = "draft" | "sending" | "sent" | "cancelled";

type Announcement = {
  id: string;
  title: string;
  body: string;
  href: string;
  status: AnnouncementStatus;
  targeted: number;
  pushed: number;
  failed: number;
  tested_at: string | null;
  created_at: string;
  finished_at: string | null;
};

type DryRunReport = {
  totalUsers: number;
  alreadyNotified: number;
  wouldNotify: number;
  withPushSubscription: number;
  optedOut: number;
  wouldPush: number;
};

const PATH = "/study-admin/announcements";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-NG", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function StatusPill({ status }: { status: AnnouncementStatus }) {
  const tone =
    status === "sent"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300"
      : status === "sending"
      ? "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-400"
      : status === "cancelled"
      ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400"
      : "bg-secondary text-muted-foreground border-border";
  const Icon = status === "sent" ? Check : status === "sending" ? Loader2 : Clock;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", tone)}>
      <Icon className={cn("h-3.5 w-3.5", status === "sending" && "animate-spin")} />
      {status}
    </span>
  );
}

/**
 * Mock of a collapsed notification. The point of this preview is the clip
 * marker: anything past PUSH_BODY_VISIBLE_HINT is dimmed, because on a phone
 * it very likely will not be read.
 */
function PushPreview({ title, body }: { title: string; body: string }) {
  const visible = body.slice(0, PUSH_BODY_VISIBLE_HINT);
  const clipped = body.slice(PUSH_BODY_VISIBLE_HINT);

  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <BellRing className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {title || <span className="text-muted-foreground">Notification title</span>}
          </p>
          <p className="text-sm leading-snug text-muted-foreground">
            {visible || <span className="italic">Notification body</span>}
            {clipped && (
              <span className="text-muted-foreground/40 line-through decoration-red-400/60">{clipped}</span>
            )}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground/70">JabuStudy</p>
        </div>
      </div>
      {clipped ? (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
          The struck-through text sits past ~{PUSH_BODY_VISIBLE_HINT} characters and will likely be
          cut off on a phone. Put anything essential before it.
        </p>
      ) : null}
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div>
      <span className="block text-muted-foreground">{label}</span>
      <span className={cn("block font-semibold", strong && "text-primary")}>
        {value.toLocaleString("en-NG")}
      </span>
    </div>
  );
}

export default function StudyAdminAnnouncementsPage() {
  const router = useRouter();

  const [title, setTitle] = useState("Help keep JabuStudy running");
  const [body, setBody] = useState(
    "If JabuStudy helped you even once this semester, help keep it running."
  );
  const [href, setHref] = useState("/support");

  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [broadcastingId, setBroadcastingId] = useState<string | null>(null);
  const [dryRunId, setDryRunId] = useState<string | null>(null);
  const [reports, setReports] = useState<Record<string, DryRunReport>>({});
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: "ok" | "err" } | null>(null);

  const titleLeft = ANNOUNCEMENT_TITLE_MAX - title.length;
  const bodyLeft = ANNOUNCEMENT_BODY_MAX - body.length;
  const canCreate = title.trim().length > 0 && body.trim().length > 0 && !creating;

  const showToast = useCallback((msg: string, tone: "ok" | "err" = "ok") => {
    setToast({ msg, tone });
    window.setTimeout(() => setToast(null), 5000);
  }, []);

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      router.replace(`/login?next=${encodeURIComponent(PATH)}`);
      return null;
    }
    return token;
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch("/api/study-admin/announcements", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        router.replace(`/login?next=${encodeURIComponent(PATH)}`);
        return;
      }
      if (res.status === 403) {
        router.replace("/study");
        return;
      }
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message || "Failed to load announcements");
      setItems(json.announcements ?? []);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [getToken, router]);

  useEffect(() => {
    // Initial fetch on mount. The setState inside load() runs after an await,
    // but the rule can't see that — same suppression the other admin pages use.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function createDraft() {
    setCreating(true);
    setErr(null);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch("/api/study-admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, body, href }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message || "Failed to save draft");
      showToast("Draft saved. Send yourself a test before broadcasting.");
      await load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed to save draft", "err");
    } finally {
      setCreating(false);
    }
  }

  async function sendTest(id: string) {
    setTestingId(id);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`/api/study-admin/announcements/${id}/test`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message || "Test failed");
      showToast(json.message ?? "Test sent.", json.pushSent ? "ok" : "err");
      await load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Test failed", "err");
    } finally {
      setTestingId(null);
    }
  }

  /** Read-only audience report. Writes nothing — safe to run any time. */
  async function dryRun(id: string) {
    setDryRunId(id);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`/api/study-admin/announcements/${id}/dry-run`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message || "Dry run failed");
      setReports((r) => ({ ...r, [id]: json.report as DryRunReport }));
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Dry run failed", "err");
    } finally {
      setDryRunId(null);
    }
  }

  /**
   * Flips the draft to 'sending', then drives the worker to completion.
   *
   * The worker returns after a time budget rather than running to the end, so
   * this keeps calling it. Progress is persisted server-side after every batch,
   * so closing the tab pauses the campaign rather than losing it.
   */
  async function broadcast(a: Announcement) {
    const report = reports[a.id];
    const audience = report
      ? `${report.wouldNotify.toLocaleString("en-NG")} students will get an in-app notification and ` +
        `${report.wouldPush.toLocaleString("en-NG")} will get a push.\n\n`
      : `You have not run a dry run, so the audience size is unknown.\n\n`;

    const confirmed = window.confirm(
      `Send "${a.title}" to every JabuStudy user?\n\n` +
        audience +
        `This cannot be undone — a push notification cannot be recalled.`
    );
    if (!confirmed) return;

    setBroadcastingId(a.id);
    try {
      const token = await getToken();
      if (!token) return;
      const H = { Authorization: `Bearer ${token}` };

      const startRes = await fetch(`/api/study-admin/announcements/${a.id}/send`, {
        method: "POST",
        headers: H,
      });
      const startJson = await startRes.json();
      if (!startRes.ok || !startJson.ok) throw new Error(startJson.message || "Failed to start");

      showToast("Broadcast started…");

      for (;;) {
        const res = await fetch(`/api/study-admin/announcements/worker?id=${a.id}`, {
          method: "POST",
          headers: H,
        });
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.message || "Worker failed");

        await load();
        if (json.done) {
          showToast(`Done — ${json.targeted} notified, ${json.pushed} pushed.`);
          break;
        }
      }
    } catch (e: unknown) {
      showToast(
        e instanceof Error ? e.message : "Broadcast failed — reopen this page to resume.",
        "err"
      );
    } finally {
      setBroadcastingId(null);
    }
  }

  /** Resumes a campaign left in 'sending' (tab closed, network dropped, etc). */
  async function resume(a: Announcement) {
    setBroadcastingId(a.id);
    try {
      const token = await getToken();
      if (!token) return;
      for (;;) {
        const res = await fetch(`/api/study-admin/announcements/worker?id=${a.id}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.message || "Worker failed");
        await load();
        if (json.done) {
          showToast(`Done — ${json.targeted} notified, ${json.pushed} pushed.`);
          break;
        }
      }
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Resume failed", "err");
    } finally {
      setBroadcastingId(null);
    }
  }

  const draftCount = useMemo(() => items.filter((a) => a.status === "draft").length, [items]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Megaphone className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold">Announcements</h1>
            <p className="text-sm text-muted-foreground">
              Broadcast to every JabuStudy user. Reaches in-app notifications for everyone, and push
              for anyone who has it enabled.
            </p>
          </div>
        </div>
        {draftCount > 0 && (
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
            {draftCount} draft{draftCount === 1 ? "" : "s"}
          </span>
        )}
      </header>

      {/* ── Composer ── */}
      <section className="grid gap-5 rounded-3xl border border-border bg-card p-5 md:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="ann-title" className="text-sm font-semibold">
              Title
            </label>
            <input
              id="ann-title"
              value={title}
              maxLength={ANNOUNCEMENT_TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="Help keep JabuStudy running"
            />
            <p className={cn("text-xs", titleLeft < 10 ? "text-amber-600" : "text-muted-foreground")}>
              {titleLeft} characters left
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ann-body" className="text-sm font-semibold">
              Body
            </label>
            <textarea
              id="ann-body"
              value={body}
              maxLength={ANNOUNCEMENT_BODY_MAX}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="One or two short sentences. The full message lives on the linked page."
            />
            <p className={cn("text-xs", bodyLeft < 20 ? "text-amber-600" : "text-muted-foreground")}>
              {bodyLeft} characters left
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ann-href" className="text-sm font-semibold">
              Opens
            </label>
            <input
              id="ann-href"
              value={href}
              onChange={(e) => setHref(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
              placeholder="/support"
            />
            <p className="text-xs text-muted-foreground">
              Relative paths only. Never send bank details or anything sensitive in the notification
              itself — put it on this page instead.
            </p>
          </div>

          <button
            type="button"
            onClick={createDraft}
            disabled={!canCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save draft
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Preview</p>
          <PushPreview title={title} body={body} />
          <p className="text-xs leading-relaxed text-muted-foreground">
            This is roughly how it lands in a phone&rsquo;s notification tray. Always send yourself a
            test and look at it on an actual phone before broadcasting — a push cannot be unsent.
          </p>
        </div>
      </section>

      {/* ── History ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Recent announcements
        </h2>

        {err && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
            {err}
          </p>
        )}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl border border-border bg-card" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No announcements yet. Save a draft above to get started.
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((a) => (
              <div key={a.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{a.title}</p>
                      <StatusPill status={a.status} />
                      {a.tested_at ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                          <Check className="h-3 w-3" /> tested
                        </span>
                      ) : (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400">
                          not tested
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>
                    <p className="mt-1.5 font-mono text-xs text-muted-foreground/80">
                      {a.href} · created {formatDate(a.created_at)}
                    </p>
                    {(a.status === "sending" || a.status === "sent") && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {a.targeted} notified · {a.pushed} pushed
                        {a.failed > 0 && ` · ${a.failed} failed`}
                        {a.finished_at && ` · finished ${formatDate(a.finished_at)}`}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => sendTest(a.id)}
                      disabled={testingId === a.id}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold transition hover:border-primary/50 disabled:opacity-50"
                    >
                      {testingId === a.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      Test on me
                    </button>

                    <button
                      type="button"
                      onClick={() => dryRun(a.id)}
                      disabled={dryRunId === a.id}
                      title="Count the audience without sending anything"
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold transition hover:border-primary/50 disabled:opacity-50"
                    >
                      {dryRunId === a.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Calculator className="h-3.5 w-3.5" />
                      )}
                      Dry run
                    </button>

                    {a.status === "sending" ? (
                      <button
                        type="button"
                        onClick={() => resume(a)}
                        disabled={broadcastingId === a.id}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                      >
                        {broadcastingId === a.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <SendHorizonal className="h-3.5 w-3.5" />
                        )}
                        {broadcastingId === a.id ? "Sending…" : "Resume"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => broadcast(a)}
                        disabled={
                          a.status !== "draft" || !a.tested_at || broadcastingId === a.id
                        }
                        title={
                          !a.tested_at
                            ? "Send yourself a test first"
                            : a.status !== "draft"
                            ? `Already ${a.status}`
                            : "Send to every JabuStudy user"
                        }
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {broadcastingId === a.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <SendHorizonal className="h-3.5 w-3.5" />
                        )}
                        Broadcast
                      </button>
                    )}
                  </div>
                </div>

                {reports[a.id] && (
                  <div className="mt-3 rounded-xl border border-border bg-secondary/40 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Dry run — nothing was sent
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
                      <Stat label="Total users" value={reports[a.id].totalUsers} />
                      <Stat label="Would notify in-app" value={reports[a.id].wouldNotify} strong />
                      <Stat label="Would push" value={reports[a.id].wouldPush} strong />
                      <Stat label="Have push enabled" value={reports[a.id].withPushSubscription} />
                      <Stat label="Opted out" value={reports[a.id].optedOut} />
                      <Stat label="Already notified" value={reports[a.id].alreadyNotified} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="flex items-start gap-1.5 rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
          Broadcast unlocks only after you send yourself a test. Sending runs in batches and reports
          progress here — keep this tab open until it finishes. If it stops early, the campaign stays
          in <span className="font-semibold">sending</span> and &ldquo;Resume&rdquo; picks up exactly
          where it left off.
        </p>
      </section>

      {toast && (
        <div
          className={cn(
            "fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg",
            toast.tone === "ok" ? "bg-foreground text-background" : "bg-red-600 text-white"
          )}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
