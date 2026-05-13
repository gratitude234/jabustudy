"use client";
// components/vendor/VendorReviews.tsx
import { cn } from "@/lib/utils";

import { useEffect, useRef, useState } from "react";
import { Star, Pencil, Trash2, Loader2, MessageSquare } from "lucide-react";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type Review = {
  id: string;
  vendor_id: string;
  reviewer_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
  reviewer_email?: string | null; // joined from auth.users via a view or RPC
};

type ReviewStats = {
  review_count: number;
  avg_rating: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-NG", { month: "short", year: "numeric" });
}

function obfuscateEmail(email?: string | null) {
  if (!email) return "Anonymous";
  const [local, domain] = email.split("@");
  if (!local || !domain) return email.slice(0, 4) + "***";
  return local.slice(0, 3) + "***@" + domain;
}

// ─── Star components ──────────────────────────────────────────────────────────

function StarRow({
  value,
  max = 5,
  size = "sm",
  interactive = false,
  onChange,
}: {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onChange?: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  const sizeClass = size === "lg" ? "h-7 w-7" : size === "md" ? "h-5 w-5" : "h-4 w-4";
  const display = interactive && hovered ? hovered : value;

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => {
        const filled = i + 1 <= display;
        return (
          <button
            key={i}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onChange?.(i + 1)}
            onMouseEnter={() => interactive && setHovered(i + 1)}
            onMouseLeave={() => interactive && setHovered(0)}
            className={cn(
              "transition-transform",
              interactive && "cursor-pointer hover:scale-110",
              !interactive && "pointer-events-none"
            )}
            aria-label={`${i + 1} star${i + 1 !== 1 ? "s" : ""}`}
          >
            <Star
              className={cn(
                sizeClass,
                filled ? "fill-amber-400 text-amber-400" : "fill-zinc-200 text-zinc-200"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

// ─── Rating summary bar ───────────────────────────────────────────────────────

function RatingBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-5 shrink-0 text-right text-zinc-600">{label}</span>
      <div className="flex-1 overflow-hidden rounded-full bg-zinc-100 h-2">
        <div
          className="h-full rounded-full bg-amber-400 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-6 shrink-0 text-zinc-500">{count}</span>
    </div>
  );
}

// ─── Review form ──────────────────────────────────────────────────────────────

function ReviewForm({
  vendorId,
  existing,
  onSaved,
  onCancel,
}: {
  vendorId: string;
  existing: Review | null;
  onSaved: (review: Review) => void;
  onCancel?: () => void;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) { setErr("Please select a star rating."); return; }
    setSaving(true);
    setErr(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErr("You must be signed in to leave a review."); setSaving(false); return; }

    const payload = {
      vendor_id: vendorId,
      reviewer_id: user.id,
      rating,
      comment: comment.trim() || null,
    };

    let result;
    if (existing) {
      result = await supabase
        .from("vendor_reviews")
        .update({ rating, comment: payload.comment })
        .eq("id", existing.id)
        .eq("reviewer_id", user.id)
        .select("id,vendor_id,reviewer_id,rating,comment,created_at,updated_at")
        .maybeSingle();
    } else {
      result = await supabase
        .from("vendor_reviews")
        .insert(payload)
        .select("id,vendor_id,reviewer_id,rating,comment,created_at,updated_at")
        .maybeSingle();
    }

    if (result.error) {
      setErr(result.error.message);
      setSaving(false);
      return;
    }

    onSaved({ ...(result.data as Review), reviewer_email: user.email });
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <p className="mb-1.5 text-xs font-semibold text-zinc-700">Your rating</p>
        <StarRow
          value={rating}
          size="lg"
          interactive
          onChange={(v) => { setRating(v); setErr(null); }}
        />
      </div>

      <div>
        <label htmlFor="review-comment" className="mb-1.5 block text-xs font-semibold text-zinc-700">
          Comment <span className="font-normal text-zinc-400">(optional)</span>
        </label>
        <textarea
          id="review-comment"
          ref={textRef}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your experience with this vendor…"
          maxLength={500}
          rows={3}
          className="w-full resize-none rounded-2xl border bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white"
        />
        <div className="mt-1 text-right text-xs text-zinc-400">{comment.length}/500</div>
      </div>

      {err && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {err}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || rating === 0}
          className="inline-flex items-center gap-2 rounded-2xl bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {existing ? "Update review" : "Submit review"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl border bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

// ─── Single review card ───────────────────────────────────────────────────────

function ReviewCard({
  review,
  isOwn,
  onEdit,
  onDelete,
}: {
  review: Review;
  isOwn: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete your review?")) return;
    setDeleting(true);
    const { error } = await supabase
      .from("vendor_reviews")
      .delete()
      .eq("id", review.id);

    if (!error) onDelete();
    else setDeleting(false);
  }

  return (
    <div className={cn("rounded-2xl border bg-white p-4", isOwn && "border-zinc-300 bg-zinc-50")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Avatar */}
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-zinc-200 text-xs font-bold text-zinc-700">
            {obfuscateEmail(review.reviewer_email).slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-800">
              {obfuscateEmail(review.reviewer_email)}
              {isOwn && (
                <span className="ml-1.5 rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                  You
                </span>
              )}
            </p>
            <p className="text-[10px] text-zinc-400">
              {timeAgo(review.updated_at !== review.created_at ? review.updated_at : review.created_at)}
              {review.updated_at !== review.created_at && " (edited)"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StarRow value={review.rating} size="sm" />
          {isOwn && (
            <div className="flex items-center gap-1">
              <button
                onClick={onEdit}
                title="Edit review"
                className="grid h-7 w-7 place-items-center rounded-full border bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                title="Delete review"
                className="grid h-7 w-7 place-items-center rounded-full border bg-white text-zinc-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {review.comment && (
        <p className="mt-3 text-sm leading-relaxed text-zinc-700">{review.comment}</p>
      )}
    </div>
  );
}

// ─── Main exported component ──────────────────────────────────────────────────

export default function VendorReviews({ vendorId, autoOpen = false }: { vendorId: string; autoOpen?: boolean }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const reviewSectionRef = useRef<HTMLDivElement>(null);

  const myReview = reviews.find((r) => r.reviewer_id === userId) ?? null;

  // Fetch reviews + auth on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const [authRes, reviewsRes, statsRes] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("vendor_reviews")
          .select("id,vendor_id,reviewer_id,rating,comment,created_at,updated_at")
          .eq("vendor_id", vendorId)
          .order("created_at", { ascending: false }),
        supabase
          .from("vendor_review_stats")
          .select("review_count,avg_rating")
          .eq("vendor_id", vendorId)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      const user = authRes.data?.user ?? null;
      setUserId(user?.id ?? null);
      setUserEmail(user?.email ?? null);

      // Attach the current user's email to their own review so it renders correctly
      const rows = ((reviewsRes.data ?? []) as Review[]).map((r) =>
        user && r.reviewer_id === user.id ? { ...r, reviewer_email: user.email } : r
      );
      setReviews(rows);

      if (statsRes.data) {
        setStats({
          review_count: Number(statsRes.data.review_count),
          avg_rating: Number(statsRes.data.avg_rating),
        });
      }

      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [vendorId]);

  // Auto-open the review form when the component was launched via ?review=1
  useEffect(() => {
    if (!autoOpen || loading) return;
    if (!userId) return; // not logged in — let the UI handle that
    setShowForm(true);
    // Smooth-scroll to the review section after a tick
    setTimeout(() => {
      reviewSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }, [autoOpen, loading, userId]);

  function handleSaved(saved: Review) {
    setReviews((prev) => {
      const exists = prev.findIndex((r) => r.id === saved.id);
      if (exists >= 0) {
        const next = [...prev];
        next[exists] = saved;
        return next;
      }
      return [saved, ...prev];
    });

    // Recompute local stats
    setStats((prev) => {
      const allRatings = reviews.map((r) => (r.id === saved.id ? saved.rating : r.rating));
      if (!reviews.find((r) => r.id === saved.id)) allRatings.push(saved.rating);
      const avg = allRatings.reduce((a, b) => a + b, 0) / allRatings.length;
      return {
        review_count: allRatings.length,
        avg_rating: Math.round(avg * 10) / 10,
      };
    });

    setShowForm(false);
    setEditingReview(null);
  }

  function handleDeleted(id: string) {
    setReviews((prev) => {
      const next = prev.filter((r) => r.id !== id);
      const avg = next.length
        ? next.reduce((a, r) => a + r.rating, 0) / next.length
        : 0;
      setStats({ review_count: next.length, avg_rating: Math.round(avg * 10) / 10 });
      return next;
    });
  }

  // Build histogram data
  const histogram = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  if (loading) {
    return (
      <div className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading reviews…
        </div>
      </div>
    );
  }

  const canReview = !!userId && !myReview;
  const reviewCount = stats?.review_count ?? reviews.length;
  const avgRating = stats?.avg_rating ?? (reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0);

  return (
    <div ref={reviewSectionRef} className="rounded-3xl border bg-white shadow-sm">
      {/* Header + summary ──────────────────────────────────────────────────── */}
      <div className="border-b p-5">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-zinc-700" />
          <h2 className="text-sm font-semibold text-zinc-900">Reviews</h2>
        </div>

        {reviewCount > 0 ? (
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-8">
            {/* Big average */}
            <div className="flex flex-col items-center justify-center gap-1 sm:min-w-[100px]">
              <span className="text-5xl font-extrabold tracking-tight text-zinc-900">
                {avgRating.toFixed(1)}
              </span>
              <StarRow value={Math.round(avgRating)} size="md" />
              <span className="text-xs text-zinc-500">
                {reviewCount} review{reviewCount !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Histogram */}
            <div className="flex-1 space-y-1.5">
              {histogram.map((h) => (
                <RatingBar
                  key={h.star}
                  label={String(h.star)}
                  count={h.count}
                  total={reviewCount}
                />
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">No reviews yet. Be the first!</p>
        )}
      </div>

      {/* Write / edit review ────────────────────────────────────────────────── */}
      <div className="border-b p-5">
        {!userId ? (
          <p className="text-sm text-zinc-600">
            <a href="/login" className="font-semibold text-zinc-900 underline underline-offset-2">
              Sign in
            </a>{" "}
            to leave a review.
          </p>
        ) : myReview && !showForm && editingReview?.id !== myReview.id ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-zinc-600">You've already reviewed this vendor.</p>
            <button
              onClick={() => { setEditingReview(myReview); setShowForm(true); }}
              className="inline-flex items-center gap-1.5 rounded-2xl border bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit your review
            </button>
          </div>
        ) : canReview && !showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            <Star className="h-4 w-4" />
            Write a review
          </button>
        ) : (showForm || editingReview) ? (
          <ReviewForm
            vendorId={vendorId}
            existing={editingReview ?? myReview}
            onSaved={handleSaved}
            onCancel={() => { setShowForm(false); setEditingReview(null); }}
          />
        ) : null}
      </div>

      {/* Reviews list ───────────────────────────────────────────────────────── */}
      <div className="space-y-3 p-5">
        {reviews.length === 0 ? (
          <p className="text-sm text-zinc-500">No reviews yet.</p>
        ) : (
          reviews.map((r) => (
            <ReviewCard
              key={r.id}
              review={r}
              isOwn={r.reviewer_id === userId}
              onEdit={() => { setEditingReview(r); setShowForm(true); }}
              onDelete={() => handleDeleted(r.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Compact star badge (for vendor header / card) ────────────────────────────
// Import and use this anywhere you want a quick "4.8 ★ (23)" badge.

export function VendorRatingBadge({
  vendorId,
}: {
  vendorId: string;
}) {
  const [stats, setStats] = useState<ReviewStats | null>(null);

  useEffect(() => {
    supabase
      .from("vendor_review_stats")
      .select("review_count,avg_rating")
      .eq("vendor_id", vendorId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setStats({ review_count: Number(data.review_count), avg_rating: Number(data.avg_rating) });
      });
  }, [vendorId]);

  if (!stats || stats.review_count === 0) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1 text-xs text-zinc-700">
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      <span className="font-semibold">{stats.avg_rating.toFixed(1)}</span>
      <span className="text-zinc-400">({stats.review_count})</span>
    </span>
  );
}