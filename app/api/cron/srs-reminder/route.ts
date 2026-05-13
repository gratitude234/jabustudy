// app/api/cron/srs-reminder/route.ts
//
// Cron route: send spaced repetition reminders to users with due cards.
//
// TRIGGERING
// ----------
// Called automatically by Vercel Cron (see vercel.json) at 07:00 UTC every day
// (equivalent to 8 AM WAT). Can also be invoked manually:
//   curl -X POST https://your-domain/api/cron/srs-reminder \
//        -H "Authorization: Bearer $CRON_SECRET"
//
// REQUIRED ENV VARS
// -----------------
//   CRON_SECRET                - shared secret Vercel sends as Bearer token
//   WHATSAPP_TOKEN             - Meta Cloud API permanent system-user access token
//   WHATSAPP_PHONE_NUMBER_ID   - Meta Business phone number ID (from API dashboard)

import { NextResponse } from "next/server";
import pLimit from "p-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendUserPush } from "@/lib/webPush";

const WHATSAPP_API_VERSION = "v19.0";
const WHATSAPP_API_BASE = `https://graph.facebook.com/${WHATSAPP_API_VERSION}`;
const SEND_LIMIT = 200;

type DueRow = { user_id: string | null };
type DailyActivityRow = { user_id: string };
type PushSubscriptionRow = { user_id: string };
type WhatsAppPrefRow = {
  user_id: string;
  whatsapp_phone: string;
  whatsapp_notify: boolean | null;
};
type ReminderSendResult = {
  pushSent: boolean;
  whatsappSent: boolean;
  errors: string[];
};

async function sendWhatsApp(
  phone: string,
  count: number,
  token: string,
  phoneNumberId: string
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const message = buildMessage(phone, count);

  const res = await fetch(`${WHATSAPP_API_BASE}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
  }

  const data = await res.json().catch(() => ({}));
  const messageId = data?.messages?.[0]?.id;
  return { ok: true, messageId };
}

function buildMessage(to: string, count: number) {
  const plural = count === 1 ? "" : "s";
  const text =
    `You have ${count} spaced repetition card${plural} due today on ` +
    `Jabumarket Study Hub.\n\nReview now to keep your learning on track: ` +
    `https://jabumarket.com/study/practice?due=1`;

  return {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  };
}

async function sendReminderToUser({
  admin,
  userId,
  count,
  todayWAT,
  pushEnabled,
  waEnabled,
  waToken,
  waPhoneId,
  whatsappPhone,
}: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  userId: string;
  count: number;
  todayWAT: string;
  pushEnabled: boolean;
  waEnabled: boolean;
  waToken: string;
  waPhoneId: string;
  whatsappPhone?: string;
}): Promise<ReminderSendResult> {
  const plural = count === 1 ? "" : "s";
  const verb = count === 1 ? "is" : "are";
  const title = "Cards due for review";
  const body = `${count} question${plural} ${verb} due today - keep your learning on track!`;
  const href = "/study/practice?due=1";
  const result: ReminderSendResult = {
    pushSent: false,
    whatsappSent: false,
    errors: [],
  };

  try {
    if (pushEnabled) {
      const { error: notifError } = await admin.from("notifications").insert({
        user_id: userId,
        type: "srs_due_reminder",
        title,
        body,
        href,
        is_read: false,
      });

      if (notifError) {
        result.errors.push(`push:${userId}: ${notifError.message}`);
      }

      await sendUserPush(userId, {
        title,
        body,
        href,
        tag: `srs-due-${todayWAT}`,
      });
      result.pushSent = true;
    }

    if (waEnabled && whatsappPhone) {
      const waResult = await sendWhatsApp(whatsappPhone, count, waToken, waPhoneId);
      if (waResult.ok) {
        result.whatsappSent = true;
      } else {
        result.errors.push(`wa:${userId}: ${waResult.error ?? "unknown"}`);
      }
    }
  } catch (error: unknown) {
    result.errors.push(
      `user:${userId}: ${error instanceof Error ? error.message : "unknown"}`
    );
  }

  return result;
}

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET ?? "";
  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const provided = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (provided !== cronSecret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const todayWAT = new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);

  const { data: dueRows, error: dueError } = await admin
    .from("study_weak_questions")
    .select("user_id")
    .lte("next_due_at", nowIso)
    .is("graduated_at", null);

  if (dueError) {
    return NextResponse.json(
      { ok: false, error: `Failed to query due cards: ${dueError.message}` },
      { status: 500 }
    );
  }

  if (!dueRows?.length) {
    return NextResponse.json({
      ok: true,
      targeted: 0,
      pushSent: 0,
      whatsappSent: 0,
      errors: [],
    });
  }

  const dueCounts = new Map<string, number>();
  for (const row of dueRows as DueRow[]) {
    if (!row.user_id) continue;
    dueCounts.set(row.user_id, (dueCounts.get(row.user_id) ?? 0) + 1);
  }

  const userIds = Array.from(dueCounts.keys());
  if (!userIds.length) {
    return NextResponse.json({
      ok: true,
      targeted: 0,
      pushSent: 0,
      whatsappSent: 0,
      errors: [],
    });
  }

  const { data: reviewedRows, error: reviewedError } = await admin
    .from("study_daily_activity")
    .select("user_id")
    .in("user_id", userIds)
    .eq("activity_date", todayWAT)
    .eq("did_practice", true);

  if (reviewedError) {
    return NextResponse.json(
      { ok: false, error: `Failed to query daily activity: ${reviewedError.message}` },
      { status: 500 }
    );
  }

  const reviewedToday = new Set(
    (reviewedRows ?? []).map((row: DailyActivityRow) => row.user_id)
  );
  const dueUserIds = userIds
    .filter((userId) => !reviewedToday.has(userId))
    .slice(0, SEND_LIMIT);

  if (!dueUserIds.length) {
    return NextResponse.json({
      ok: true,
      targeted: 0,
      pushSent: 0,
      whatsappSent: 0,
      errors: [],
    });
  }

  const [pushSubsRes, waPrefsRes] = await Promise.all([
    admin
      .from("user_push_subscriptions")
      .select("user_id")
      .in("user_id", dueUserIds),
    admin
      .from("study_preferences")
      .select("user_id, whatsapp_phone, whatsapp_notify")
      .in("user_id", dueUserIds)
      .eq("whatsapp_notify", true)
      .not("whatsapp_phone", "is", null),
  ]);

  if (pushSubsRes.error) {
    return NextResponse.json(
      {
        ok: false,
        error: `Failed to query push subscriptions: ${pushSubsRes.error.message}`,
      },
      { status: 500 }
    );
  }

  if (waPrefsRes.error) {
    return NextResponse.json(
      {
        ok: false,
        error: `Failed to query WhatsApp preferences: ${waPrefsRes.error.message}`,
      },
      { status: 500 }
    );
  }

  const pushUserIds = new Set(
    (pushSubsRes.data ?? []).map((row: PushSubscriptionRow) => row.user_id)
  );
  const waPrefsByUser = new Map(
    ((waPrefsRes.data ?? []) as WhatsAppPrefRow[]).map((row) => [row.user_id, row])
  );

  const targetUserIds = dueUserIds.filter(
    (userId) => pushUserIds.has(userId) || waPrefsByUser.has(userId)
  );
  if (!targetUserIds.length) {
    return NextResponse.json({
      ok: true,
      targeted: 0,
      pushSent: 0,
      whatsappSent: 0,
      errors: [],
    });
  }

  console.log(`[srs-reminder] Processing ${targetUserIds.length} users`);

  const waToken = process.env.WHATSAPP_TOKEN ?? "";
  const waPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
  const waEnabled = Boolean(waToken && waPhoneId);
  const errors: string[] = [];

  if (!waEnabled) {
    errors.push("whatsapp: WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set");
  }

  const limit = pLimit(5);
  const sendResults = await Promise.all(
    targetUserIds.map((userId) =>
      limit(() =>
        sendReminderToUser({
          admin,
          userId,
          count: dueCounts.get(userId) ?? 0,
          todayWAT,
          pushEnabled: pushUserIds.has(userId),
          waEnabled,
          waToken,
          waPhoneId,
          whatsappPhone: waPrefsByUser.get(userId)?.whatsapp_phone,
        })
      )
    )
  );

  const pushSent = sendResults.filter((result) => result.pushSent).length;
  const whatsappSent = sendResults.filter((result) => result.whatsappSent).length;
  errors.push(...sendResults.flatMap((result) => result.errors));

  return NextResponse.json({
    ok: true,
    targeted: targetUserIds.length,
    pushSent,
    whatsappSent,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
  });
}

export { POST as GET };
