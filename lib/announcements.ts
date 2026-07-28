import "server-only";

import {
  ANNOUNCEMENT_BODY_MAX,
  ANNOUNCEMENT_TITLE_MAX,
} from "./announcementLimits";

export {
  ANNOUNCEMENT_BODY_MAX,
  ANNOUNCEMENT_TITLE_MAX,
  PUSH_BODY_VISIBLE_HINT,
} from "./announcementLimits";

export type AnnouncementStatus = "draft" | "sending" | "sent" | "cancelled";

export type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  href: string;
  status: AnnouncementStatus;
  cursor_id: string | null;
  targeted: number;
  pushed: number;
  failed: number;
  tested_at: string | null;
  created_by: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

/** Notification `type` for a campaign — also the per-user dedupe key. */
export function announcementNotificationType(id: string) {
  return `announcement_${id}`;
}

/** Push `tag` — lets the OS collapse duplicates if a batch is replayed. */
export function announcementPushTag(id: string) {
  return `announcement-${id}`;
}

function cleanLine(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  // Newlines are dropped: push bodies render them inconsistently across platforms.
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export type AnnouncementInput = {
  title: string;
  body: string;
  href: string;
};

/**
 * Validates composer input. Throws an httpError-shaped error on bad input so
 * route handlers can surface `status`/`code` the same way the rest of the API does.
 */
export function parseAnnouncementInput(raw: unknown): AnnouncementInput {
  const src = (raw ?? {}) as Record<string, unknown>;

  const title = cleanLine(src.title, ANNOUNCEMENT_TITLE_MAX);
  const body = cleanLine(src.body, ANNOUNCEMENT_BODY_MAX);
  const hrefRaw = typeof src.href === "string" ? src.href.trim() : "";
  const href = hrefRaw || "/support";

  if (!title) throw httpError("Title is required.", 400, "MISSING_TITLE");
  if (!body) throw httpError("Body is required.", 400, "MISSING_BODY");

  // Relative paths only — an announcement must never send students off-domain,
  // which is exactly the shape a phishing push would take.
  if (!href.startsWith("/") || href.startsWith("//")) {
    throw httpError("Link must be a relative path such as /support.", 400, "INVALID_HREF");
  }

  return { title, body, href };
}

export function httpError(message: string, status: number, code: string) {
  return Object.assign(new Error(message), { status, code });
}

export function errorInfo(error: unknown) {
  const e = error as { message?: unknown; status?: unknown; code?: unknown };
  return {
    message: typeof e.message === "string" ? e.message : "Server error",
    status: typeof e.status === "number" ? e.status : 500,
    code: typeof e.code === "string" ? e.code : "SERVER_ERROR",
  };
}
