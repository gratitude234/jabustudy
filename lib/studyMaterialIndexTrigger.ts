// Fire-and-forget helper for kicking off material indexing from upload/approval routes.

import "server-only";

function appBaseUrl(): string | null {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (siteUrl) return siteUrl.replace(/\/$/, "");

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl.replace(/\/$/, "")}`;

  return "http://localhost:3000";
}

function indexAuthToken(): string | null {
  return process.env.CRON_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
}

export function triggerMaterialIndex(materialId: string) {
  const baseUrl = appBaseUrl();
  const token = indexAuthToken();
  if (!baseUrl || !token) {
    console.warn("[triggerMaterialIndex] missing base URL or auth token");
    return;
  }

  fetch(`${baseUrl}/api/study/materials/index`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ materialId }),
  }).catch((error) => {
    console.warn("[triggerMaterialIndex] failed:", error instanceof Error ? error.message : error);
  });
}
