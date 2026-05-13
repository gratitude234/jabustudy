"use client";

import { useEffect, useState } from "react";
import type { StudyHomeMoreBadgeTone } from "@/lib/studyAnalytics.types";
import { useStudyPrefs } from "./StudyPrefsContext";

type MoreBadge = {
  label: string;
  tone: StudyHomeMoreBadgeTone;
};

type BadgeRow = {
  subtitle: string;
  badge: MoreBadge | null;
};

type ApplyRepBadgeRow = BadgeRow & {
  hidden: boolean;
};

export type MoreBadgesPayload = {
  ok: true;
  badges: {
    ai_plan: BadgeRow & { badge: null };
    qa_forum: BadgeRow;
    gpa: BadgeRow & { badge: null };
    leaderboard: BadgeRow;
    tutors: BadgeRow & { badge: null };
    apply_rep: ApplyRepBadgeRow;
  };
};

type CachedPayload = {
  ts: number;
  userId: string;
  data: MoreBadgesPayload;
};

type State =
  | { status: "idle"; userId: string | null }
  | { status: "loading"; userId: string }
  | { status: "success"; userId: string; data: MoreBadgesPayload }
  | { status: "error"; userId: string };

let cache: CachedPayload | null = null;
const TTL_MS = 60_000;

function getCached(userId: string | null) {
  if (!userId || !cache) return null;
  if (cache.userId !== userId) return null;
  if (Date.now() - cache.ts >= TTL_MS) return null;
  return cache.data;
}

export function invalidateMoreBadges() {
  cache = null;
}

function getInitialState(userId: string | null): State {
  const cached = getCached(userId);
  if (userId && cached) {
    return { status: "success", userId, data: cached };
  }
  return { status: "idle", userId };
}

export function useMoreBadges(enabled: boolean) {
  const { userId } = useStudyPrefs();
  const [state, setState] = useState<State>(() => getInitialState(userId));

  const cached = getCached(userId);
  const currentState =
    userId && cached
      ? ({ status: "success", userId, data: cached } as const)
      : state.userId === userId
      ? state
      : ({ status: "idle", userId } as const);

  useEffect(() => {
    if (!userId) {
      invalidateMoreBadges();
      return;
    }

    if (cache && cache.userId !== userId) {
      invalidateMoreBadges();
    }

    if (!enabled) return;
    if (getCached(userId)) return;
    if (currentState.status === "loading" || currentState.status === "success") return;

    let cancelled = false;

    void (async () => {
      await Promise.resolve();
      if (cancelled) return;

      setState({ status: "loading", userId });

      try {
        const response = await fetch("/api/study/more-badges", {
          credentials: "same-origin",
        });
        const payload = (await response.json().catch(() => null)) as
          | MoreBadgesPayload
          | { ok?: false }
          | null;

        if (cancelled) return;
        if (!response.ok || !payload?.ok) {
          setState({ status: "error", userId });
          return;
        }

        cache = { ts: Date.now(), userId, data: payload };
        setState({ status: "success", userId, data: payload });
      } catch {
        if (!cancelled) setState({ status: "error", userId });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentState.status, enabled, userId]);

  return currentState;
}
