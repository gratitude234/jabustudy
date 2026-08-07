type ExamSprintCommunityEnvironment = {
  NEXT_PUBLIC_WHATSAPP_COMMUNITY_URL?: string;
  [key: string]: string | undefined;
};

export type ExamSprintWhatsAppDestination = "channel" | "community";

function destinationType(url: URL): ExamSprintWhatsAppDestination | null {
  const hostname = url.hostname.toLowerCase();

  if (hostname === "chat.whatsapp.com" && url.pathname !== "/") {
    return "community";
  }

  if (
    (hostname === "whatsapp.com" || hostname === "www.whatsapp.com")
    && /^\/channel\/[^/]+\/?$/i.test(url.pathname)
  ) {
    return "channel";
  }

  return null;
}

export function normalizeExamSprintCommunityUrl(value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (
      url.protocol !== "https:"
      || url.port
      || url.username
      || url.password
      || !destinationType(url)
    ) {
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

export function getExamSprintWhatsAppDestinationType(
  value: string | null | undefined,
): ExamSprintWhatsAppDestination | null {
  const normalized = normalizeExamSprintCommunityUrl(value);
  if (!normalized) return null;

  try {
    return destinationType(new URL(normalized));
  } catch {
    return null;
  }
}

export function getExamSprintCommunityUrl(
  environment: ExamSprintCommunityEnvironment = process.env,
) {
  return normalizeExamSprintCommunityUrl(environment.NEXT_PUBLIC_WHATSAPP_COMMUNITY_URL);
}
