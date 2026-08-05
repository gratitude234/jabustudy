export const DEFAULT_PUBLIC_SITE_URL = "https://www.jabustudy.com";

type PublicUrlEnvironment = Record<string, string | undefined>;

export function publicSiteOrigin(environment: PublicUrlEnvironment = process.env) {
  const configured = environment.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return DEFAULT_PUBLIC_SITE_URL;

  try {
    const url = new URL(configured);
    if (url.protocol !== "http:" && url.protocol !== "https:") return DEFAULT_PUBLIC_SITE_URL;
    return url.origin;
  } catch {
    return DEFAULT_PUBLIC_SITE_URL;
  }
}

export function publicUrl(path: string, environment: PublicUrlEnvironment = process.env) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${publicSiteOrigin(environment)}${normalizedPath}`;
}

export function metadataBaseUrl(environment: PublicUrlEnvironment = process.env) {
  return new URL(publicSiteOrigin(environment));
}
