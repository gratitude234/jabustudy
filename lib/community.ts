const WHATSAPP_INVITE_RE = /^https:\/\/(?:chat\.whatsapp\.com|wa\.me|(?:www\.)?whatsapp\.com)\//i;

function resolveWhatsAppCommunityUrl() {
  const raw = process.env.NEXT_PUBLIC_WHATSAPP_COMMUNITY_URL?.trim() ?? "";
  if (!raw || !WHATSAPP_INVITE_RE.test(raw)) return "";
  return raw;
}

export const WHATSAPP_COMMUNITY_URL = resolveWhatsAppCommunityUrl();
