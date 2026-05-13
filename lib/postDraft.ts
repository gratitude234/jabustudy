export const POST_DRAFT_KEY = "jm_post_draft_v1";
export const POST_DRAFT_EVENT = "jm-post-draft-changed";

type PostDraftLike = {
  title?: unknown;
  description?: unknown;
  priceDigits?: unknown;
  priceLabel?: unknown;
  location?: unknown;
};

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function hasPostDraftContent(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const draft = value as PostDraftLike;
  return (
    hasText(draft.title) ||
    hasText(draft.description) ||
    hasText(draft.priceDigits) ||
    hasText(draft.priceLabel) ||
    hasText(draft.location)
  );
}

export function readPostDraftRaw(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(POST_DRAFT_KEY);
}

export function hasSavedPostDraft(raw: string | null): boolean {
  if (!raw) return false;
  try {
    return hasPostDraftContent(JSON.parse(raw));
  } catch {
    return false;
  }
}

export function emitPostDraftChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(POST_DRAFT_EVENT));
}

export function savePostDraft(value: unknown) {
  if (typeof window === "undefined") return;
  if (hasPostDraftContent(value)) {
    window.localStorage.setItem(POST_DRAFT_KEY, JSON.stringify(value));
  } else {
    window.localStorage.removeItem(POST_DRAFT_KEY);
  }
  emitPostDraftChanged();
}

export function clearPostDraft() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(POST_DRAFT_KEY);
  emitPostDraftChanged();
}
