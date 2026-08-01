const DEFAULT_RETURN_PATH = "/study";

export function sanitizeBillingReturnPath(value: unknown) {
  if (typeof value !== "string") return DEFAULT_RETURN_PATH;
  const candidate = value.trim().slice(0, 500);
  if (!candidate.startsWith("/study/")) return DEFAULT_RETURN_PATH;
  if (candidate.startsWith("//") || candidate.includes("\\")) return DEFAULT_RETURN_PATH;

  try {
    const parsed = new URL(candidate, "https://jabustudy.invalid");
    if (parsed.origin !== "https://jabustudy.invalid") return DEFAULT_RETURN_PATH;
    if (decodeURIComponent(parsed.pathname).includes("\\")) return DEFAULT_RETURN_PATH;
    const normalized = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (parsed.pathname === "/study/billing" || parsed.pathname.startsWith("/study/billing/")) return DEFAULT_RETURN_PATH;
    return normalized;
  } catch {
    return DEFAULT_RETURN_PATH;
  }
}
