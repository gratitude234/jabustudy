"use client";

import { supabase } from "@/lib/supabase";
import type { StudyHomeCta } from "./studyAnalytics.types";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type StudyHomeHeroState = "new_user" | "due_cards" | "continue" | "idle";
export type StudyHomeBanner =
  | "semester_mismatch"
  | "setup_nudge"
  | "exam_urgent"
  | "exam_soon";

declare global {
  interface Window {
    __studyAnalyticsSessionId?: string;
    __studyAnalyticsFlags?: Record<string, boolean>;
  }
}

const isBrowser = typeof window !== "undefined";
const isDev = process.env.NODE_ENV === "development";
const MAX_PROPERTY_KEYS = 16;
let cachedUserId: string | null = null;

function devLog(method: "debug" | "warn", message: string, ...args: unknown[]) {
  if (isDev) console[method](message, ...args);
}

function sanitizeValue(value: unknown, seen = new WeakSet<object>()): JsonValue | undefined {
  if (value == null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) {
    const next = value
      .map((item) => sanitizeValue(item, seen))
      .filter((item): item is JsonValue => item !== undefined);
    return next;
  }
  if (typeof value !== "object") return undefined;
  if (seen.has(value)) return undefined;
  seen.add(value);
  const next: Record<string, JsonValue> = {};
  for (const [key, nested] of Object.entries(value)) {
    const sanitized = sanitizeValue(nested, seen);
    if (sanitized !== undefined) next[key] = sanitized;
  }
  seen.delete(value);
  return next;
}

function sanitizeProperties(properties?: Record<string, unknown>) {
  if (!properties) return {};
  const entries = Object.entries(properties).filter(([, value]) => value !== undefined);
  if (entries.length > MAX_PROPERTY_KEYS) {
    devLog("warn", "[studyAnalytics] Dropping oversized event properties payload.");
    return {};
  }
  const next: Record<string, JsonValue> = {};
  for (const [key, value] of entries) {
    const sanitized = sanitizeValue(value);
    if (sanitized !== undefined) next[key] = sanitized;
  }
  return next;
}

function getSessionId() {
  if (!isBrowser) return null;
  window.__studyAnalyticsSessionId ??= crypto.randomUUID();
  return window.__studyAnalyticsSessionId;
}

if (isBrowser) {
  void supabase.auth
    .getUser()
    .then(({ data }) => {
      cachedUserId = data.user?.id ?? null;
    })
    .catch(() => {});
  supabase.auth.onAuthStateChange((_event, session) => {
    cachedUserId = session?.user?.id ?? null;
  });
}

export function track(eventName: string, properties?: Record<string, unknown>) {
  if (!isBrowser) return;
  try {
    const payload = {
      ...sanitizeProperties(properties),
      url: window.location.pathname,
      referrer: document.referrer || null,
    };
    void (async () => {
      try {
        const { error } = await supabase.from("study_events").insert({
          user_id: cachedUserId,
          session_id: getSessionId(),
          event_name: eventName,
          properties: payload,
        });
        if (error) devLog("debug", "[studyAnalytics] Insert skipped.", error.message);
      } catch {}
    })();
  } catch {
    // analytics must never block UI
  }
}

export function trackHomeView(
  heroState: StudyHomeHeroState,
  extra?: Record<string, unknown>
) {
  track("study_home_viewed", { hero_state: heroState, ...extra });
}

export function trackHomeCta(cta: StudyHomeCta, extra?: Record<string, unknown>) {
  track("study_home_cta_tapped", { cta, ...extra });
}

export function trackHomeBannerViewed(
  banner: StudyHomeBanner,
  extra?: Record<string, unknown>
) {
  track("study_home_banner_viewed", { banner, ...extra });
}

export function trackHomeBannerDismissed(banner: StudyHomeBanner) {
  track("study_home_banner_dismissed", { banner });
}

export function trackHomeBannerActioned(
  banner: StudyHomeBanner,
  extra?: Record<string, unknown>
) {
  track("study_home_banner_actioned", { banner, ...extra });
}

// Study home taxonomy:
// - study_home_viewed
// - study_home_cta_tapped
// - study_home_banner_viewed
// - study_home_banner_dismissed
// - study_home_banner_actioned
// - study_home_filter_toggled
// - study_home_filter_opened
// - study_home_more_opened
// - study_home_more_item_tapped
//   props: { item, had_badge, badge_label?, badge_tone? }
// - study_home_day_one_viewed
//   props: { has_set, source? }
// - study_home_day_one_cta_tapped
//   props: { cta, set_id?, source? }
// - study_home_quickstart_viewed
//   props: { steps_done }
// - study_onboarding_first_set_started
// - study_onboarding_first_set_skipped
