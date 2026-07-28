import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type NotificationCategory =
  | "answers"
  | "upvotes"
  | "materials"
  | "quizzes"
  | "milestones"
  | "reminders"
  | "rep_alerts"
  | "announcements";

type NotificationPreferences = Partial<Record<NotificationCategory, boolean>>;

const KNOWN_CATEGORIES = new Set<string>([
  "answers",
  "upvotes",
  "materials",
  "quizzes",
  "milestones",
  "reminders",
  "rep_alerts",
  "announcements",
]);

function validatePrefs(raw: unknown): NotificationPreferences {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: NotificationPreferences = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (KNOWN_CATEGORIES.has(k) && typeof v === "boolean") {
      out[k as NotificationCategory] = v;
    }
  }
  return out;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return jsonError("Unauthorized", 401);

    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("user_notification_preferences")
      .select("push_categories")
      .eq("user_id", user.id)
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      preferences: (data?.push_categories ?? {}) as NotificationPreferences,
    });
  } catch {
    return jsonError("Server error", 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return jsonError("Unauthorized", 401);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    const patch = validatePrefs(body);

    const admin = createSupabaseAdminClient();

    // Fetch existing row to merge (prevents overwriting unrelated prefs)
    const { data: existing } = await admin
      .from("user_notification_preferences")
      .select("push_categories")
      .eq("user_id", user.id)
      .maybeSingle();

    const merged: NotificationPreferences = {
      ...((existing?.push_categories ?? {}) as NotificationPreferences),
      ...patch,
    };

    await admin
      .from("user_notification_preferences")
      .upsert(
        { user_id: user.id, push_categories: merged, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );

    return NextResponse.json({ ok: true, preferences: merged });
  } catch {
    return jsonError("Server error", 500);
  }
}
