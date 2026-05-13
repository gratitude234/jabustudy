export { cn } from "@/lib/utils";
// app/me/_components/utils.ts

export function initials(nameOrEmail?: string | null) {
  const s = (nameOrEmail ?? "").trim();
  if (!s) return "U";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "U";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase();
}

export function pillTone(kind: "good" | "warn" | "base") {
  if (kind === "good") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (kind === "warn") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-zinc-50 text-zinc-700 border-zinc-200";
}

export function normalizePhone(input?: string | null) {
  if (!input) return "";
  return input.replace(/[^\d+]/g, "").trim();
}

export function avatarGradient(name?: string | null): string {
  const palettes: [string, string][] = [
    ["#c2410c", "#ea580c"],
    ["#7c3aed", "#a855f7"],
    ["#0f766e", "#14b8a6"],
    ["#1d4ed8", "#3b82f6"],
    ["#b45309", "#d97706"],
    ["#be123c", "#f43f5e"],
  ];
  const i = ((name ?? "U").charCodeAt(0)) % palettes.length;
  return `linear-gradient(135deg, ${palettes[i][0]}, ${palettes[i][1]})`;
}

export function defaultVendorNameFromEmail(email?: string | null) {
  const e = (email ?? "").trim();
  if (!e) return "My Store";
  const local = e.split("@")[0] ?? "My Store";
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .slice(0, 40);
}