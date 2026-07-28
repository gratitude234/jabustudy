// Client-safe constants. Kept out of lib/announcements.ts because that module is
// server-only, and the composer UI needs these to render its preview.

export const ANNOUNCEMENT_TITLE_MAX = 60;
export const ANNOUNCEMENT_BODY_MAX = 200;

/**
 * Roughly where Android/iOS stop showing a notification body in the collapsed
 * tray. Not a hard limit — the composer uses it to warn that text past this
 * point may never be read.
 */
export const PUSH_BODY_VISIBLE_HINT = 120;
