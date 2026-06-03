export type WhatsAppCommunityStatus = {
  whatsapp_join_clicked_at: string | null;
  whatsapp_join_confirmed_at: string | null;
  whatsapp_dismissed_until: string | null;
};

const WHATSAPP_COMMUNITY_STORAGE_PREFIX = "jabu:whatsapp-community-status";

function storageKey(userId: string) {
  return `${WHATSAPP_COMMUNITY_STORAGE_PREFIX}:${userId}`;
}

export function shouldShowWhatsAppCommunityPrompt(status: WhatsAppCommunityStatus | null) {
  if (!status) return true;
  if (status.whatsapp_join_confirmed_at || status.whatsapp_join_clicked_at) return false;
  if (!status.whatsapp_dismissed_until) return true;

  const dismissedUntil = new Date(status.whatsapp_dismissed_until).getTime();
  if (!Number.isFinite(dismissedUntil)) return true;

  return dismissedUntil <= Date.now();
}

export function readLocalWhatsAppCommunityStatus(userId: string) {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<WhatsAppCommunityStatus> | null;
    if (!parsed || typeof parsed !== "object") return null;

    return {
      whatsapp_join_clicked_at: parsed.whatsapp_join_clicked_at ?? null,
      whatsapp_join_confirmed_at: parsed.whatsapp_join_confirmed_at ?? null,
      whatsapp_dismissed_until: parsed.whatsapp_dismissed_until ?? null,
    };
  } catch {
    return null;
  }
}

export function saveLocalWhatsAppCommunityStatus(
  userId: string | null,
  status: Partial<WhatsAppCommunityStatus>
) {
  if (!userId || typeof window === "undefined") return;

  try {
    const previous = readLocalWhatsAppCommunityStatus(userId);
    window.localStorage.setItem(
      storageKey(userId),
      JSON.stringify({
        whatsapp_join_clicked_at: null,
        whatsapp_join_confirmed_at: null,
        whatsapp_dismissed_until: null,
        ...previous,
        ...status,
      })
    );
  } catch {
    // non-critical
  }
}
