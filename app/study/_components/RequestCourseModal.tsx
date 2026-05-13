"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Pre-fill the course code (e.g. from current filter) */
  initialCourseCode?: string;
};

export function RequestCourseModal({ open, onClose, initialCourseCode }: Props) {
  const [courseCode, setCourseCode] = useState(initialCourseCode ?? "");
  const [courseTitle, setCourseTitle] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Sync pre-fill when prop changes
  useEffect(() => {
    if (open) {
      setCourseCode(initialCourseCode ?? "");
      setCourseTitle("");
      setNote("");
      setError(null);
      setSuccess(false);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open, initialCourseCode]);

  // Scroll lock + ESC close
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = courseCode.trim().toUpperCase();
    if (!code || code.length < 3) {
      setError("Enter a valid course code (e.g. CSC 201).");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/study/course-requests/student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_code: code,
          course_title: courseTitle.trim() || null,
          note: note.trim() || null,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to submit request.");
      }

      setSuccess(true);
    } catch (err) {
      setError((err as Error)?.message ?? "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Request missing content"
        className={cn(
          "relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-border bg-card shadow-2xl",
          "sm:mx-4"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <p className="text-base font-extrabold text-foreground">Request this course</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              We&apos;ll notify you when content is available.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={cn(
              "grid h-8 w-8 place-items-center rounded-full bg-muted text-muted-foreground",
              "hover:bg-secondary hover:text-foreground transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {success ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="text-sm font-extrabold text-foreground">Request submitted!</p>
              <p className="text-sm text-muted-foreground">
                We&apos;ll notify you when content is available for this course.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 rounded-2xl bg-secondary px-5 py-2.5 text-sm font-semibold text-foreground hover:opacity-90"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <label className="block">
                <span className="text-xs font-extrabold text-muted-foreground">
                  Course code <span className="text-rose-500">*</span>
                </span>
                <input
                  ref={inputRef}
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  placeholder="e.g. CSC 201"
                  className={cn(
                    "mt-1 w-full rounded-2xl border border-border bg-background px-3 py-3 text-sm font-semibold text-foreground",
                    "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                    "placeholder:text-muted-foreground"
                  )}
                />
              </label>

              <label className="block">
                <span className="text-xs font-extrabold text-muted-foreground">
                  Course title <span className="text-muted-foreground font-normal">(optional)</span>
                </span>
                <input
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  placeholder="e.g. Introduction to Programming"
                  className={cn(
                    "mt-1 w-full rounded-2xl border border-border bg-background px-3 py-3 text-sm font-semibold text-foreground",
                    "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                    "placeholder:text-muted-foreground"
                  )}
                />
              </label>

              <label className="block">
                <span className="text-xs font-extrabold text-muted-foreground">
                  Note <span className="text-muted-foreground font-normal">(optional)</span>
                </span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 400))}
                  placeholder="Any specific materials you need? (past questions, handouts…)"
                  rows={3}
                  className={cn(
                    "mt-1 w-full resize-none rounded-2xl border border-border bg-background px-3 py-3 text-sm font-semibold text-foreground",
                    "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                    "placeholder:text-muted-foreground"
                  )}
                />
                <p className="mt-1 text-right text-xs text-muted-foreground">{note.length}/400</p>
              </label>

              {error && (
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/30 dark:text-rose-400">
                  {error}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground hover:bg-secondary/50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={cn(
                    "flex-1 inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold",
                    submitting
                      ? "bg-muted text-muted-foreground"
                      : "bg-secondary text-foreground hover:opacity-90"
                  )}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {submitting ? "Submitting…" : "Submit request"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
