export function normalizeWhatsAppNumber(
  input: string,
  defaultCountryCode = "234"
) {
  const digits = String(input ?? "").replace(/[^\d]/g, "");
  if (!digits) return "";

  // Already in international format (e.g. 2347069269063)
  if (digits.startsWith(defaultCountryCode)) return digits;

  // Nigeria local formats: 070..., 080..., 081..., 090..., 091... (11 digits)
  if (digits.length === 11 && digits.startsWith("0")) {
    return defaultCountryCode + digits.slice(1);
  }

  // Sometimes users type 7069269063 (10 digits) -> assume Nigeria
  if (digits.length === 10) {
    return defaultCountryCode + digits;
  }

  // Fallback: return digits as-is (could already be another country code)
  return digits;
}

export function getWhatsAppLink(phone: string, text?: string) {
  const safe = normalizeWhatsAppNumber(phone);
  if (!safe) return "";

  const base = `https://wa.me/${safe}`;
  if (!text) return base;

  const msg = encodeURIComponent(text);
  return `${base}?text=${msg}`;
}
