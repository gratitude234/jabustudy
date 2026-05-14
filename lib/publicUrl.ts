export function publicUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

export function metadataBaseUrl() {
  return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
}
