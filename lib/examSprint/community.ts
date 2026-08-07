type ExamSprintCommunityEnvironment = {
  NEXT_PUBLIC_WHATSAPP_COMMUNITY_URL?: string;
  [key: string]: string | undefined;
};

export function normalizeExamSprintCommunityUrl(value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (
      url.protocol !== "https:"
      || url.hostname.toLowerCase() !== "chat.whatsapp.com"
      || url.port
      || url.username
      || url.password
      || url.pathname === "/"
    ) {
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

export function getExamSprintCommunityUrl(
  environment: ExamSprintCommunityEnvironment = process.env,
) {
  return normalizeExamSprintCommunityUrl(environment.NEXT_PUBLIC_WHATSAPP_COMMUNITY_URL);
}
