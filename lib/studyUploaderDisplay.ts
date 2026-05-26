import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PublicUploader = {
  displayName: string;
  initials: string;
};

export type AdminUploader = {
  fullName: string | null;
  email: string | null;
  displayName: string;
};

const FALLBACK_PUBLIC_NAME = "A student";

function cleanName(name: string | null | undefined) {
  return (name ?? "").trim().replace(/\s+/g, " ");
}

function publicDisplayName(fullName: string | null | undefined) {
  const name = cleanName(fullName);
  if (!name) return FALLBACK_PUBLIC_NAME;

  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0];

  const first = parts[0];
  const lastInitial = parts[parts.length - 1]?.charAt(0).toUpperCase();
  return lastInitial ? `${first} ${lastInitial}.` : first;
}

function initialsFor(name: string) {
  const parts = cleanName(name).split(" ").filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");
  return letters || "?";
}

export function fallbackPublicUploader(): PublicUploader {
  return {
    displayName: FALLBACK_PUBLIC_NAME,
    initials: initialsFor(FALLBACK_PUBLIC_NAME),
  };
}

function publicUploaderFromName(fullName: string | null | undefined): PublicUploader {
  const displayName = publicDisplayName(fullName);
  return {
    displayName,
    initials: initialsFor(displayName),
  };
}

function uniqueIds(ids: Array<string | null | undefined>) {
  return Array.from(new Set(ids.filter((id): id is string => typeof id === "string" && id.length > 0)));
}

export async function getPublicUploaderMap(ids: Array<string | null | undefined>) {
  const userIds = uniqueIds(ids);
  const map: Record<string, PublicUploader> = {};
  for (const id of userIds) map[id] = fallbackPublicUploader();
  if (userIds.length === 0) return map;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("profiles").select("id,full_name").in("id", userIds);
  if (error) return map;

  for (const row of (data ?? []) as Array<{ id: string; full_name: string | null }>) {
    map[row.id] = publicUploaderFromName(row.full_name);
  }
  return map;
}

export async function attachPublicUploaders<T extends { uploader_id?: string | null }>(rows: T[]) {
  const uploaderMap = await getPublicUploaderMap(rows.map((row) => row.uploader_id));
  return rows.map((row) => ({
    ...row,
    uploader: row.uploader_id ? uploaderMap[row.uploader_id] ?? fallbackPublicUploader() : fallbackPublicUploader(),
  }));
}

export async function getAdminUploaderMap(ids: Array<string | null | undefined>) {
  const userIds = uniqueIds(ids);
  const map: Record<string, AdminUploader> = {};
  if (userIds.length === 0) return map;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("profiles").select("id,full_name,email").in("id", userIds);
  if (error) return map;

  for (const row of (data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
    const fullName = cleanName(row.full_name) || null;
    const email = cleanName(row.email) || null;
    map[row.id] = {
      fullName,
      email,
      displayName: fullName ?? email ?? "Unknown uploader",
    };
  }
  return map;
}
