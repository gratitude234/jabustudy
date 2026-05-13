// app/api/cron/streak-reminder/route.ts
//
// Cron route: send WhatsApp streak reminders to at-risk users.
//
// TRIGGERING
// ----------
// Called automatically by Vercel Cron (see vercel.json) at 19:00 UTC every day
// (equivalent to 8 PM WAT, a good evening nudge).
// Can also be invoked manually:
//   curl -X POST https://your-domain/api/cron/streak-reminder \
//        -H "Authorization: Bearer $CRON_SECRET"
//
// REQUIRED ENV VARS
// -----------------
//   CRON_SECRET                - shared secret Vercel sends as Bearer token
//   WHATSAPP_TOKEN             - Meta Cloud API permanent system-user access token
//   WHATSAPP_PHONE_NUMBER_ID   - Meta Business phone number ID (from API dashboard)
//
// AT-RISK DEFINITION
// ------------------
// A user is "at risk" today when:
//   - They have a streak > 0
//   - They did practice yesterday
//   - They have not practiced today yet
//   - They opted in: whatsapp_notify = true AND whatsapp_phone IS NOT NULL

import { NextResponse } from "next/server";
import pLimit from "p-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const WHATSAPP_API_VERSION = "v19.0";
const WHATSAPP_API_BASE = `https://graph.facebook.com/${WHATSAPP_API_VERSION}`;
const SEND_LIMIT = 200;

type AtRiskRow = {
  user_id: string;
  whatsapp_phone: string;
  streak: number;
};

type SendResult = {
  phone: string;
  ok: boolean;
  waMessageId?: string;
  error?: string;
};

async function sendWhatsApp(
  phone: string,
  streak: number,
  token: string,
  phoneNumberId: string
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const message = buildMessage(phone, streak);

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

function buildMessage(to: string, streak: number) {
  const streakLabel = streak === 1 ? "1-day streak" : `${streak}-day streak`;
  const text =
    `Your ${streakLabel} ends at midnight!\n\n` +
    `Practice just one set on JABU Study Hub to keep it alive.\n\n` +
    `https://jabu.edu.ng/study/practice`;

  return {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  };
}

async function fetchAtRiskUsers(): Promise<AtRiskRow[]> {
  const admin = createSupabaseAdminClient();

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const yesterday = new Date(today.getTime() - 86_400_000);
  const yestKey = yesterday.toISOString().slice(0, 10);

  const { data: ystRows, error: ystErr } = await admin
    .from("study_daily_activity")
    .select("user_id")
    .eq("activity_date", yestKey)
    .eq("did_practice", true);

  if (ystErr || !ystRows?.length) return [];

  const ystUserIds = ystRows.map((row: { user_id: string }) => row.user_id);

  const { data: todayRows } = await admin
    .from("study_daily_activity")
    .select("user_id")
    .eq("activity_date", todayKey)
    .eq("did_practice", true)
    .in("user_id", ystUserIds);

  const doneToday = new Set(
    (todayRows ?? []).map((row: { user_id: string }) => row.user_id)
  );
  const atRiskIds = ystUserIds.filter((id) => !doneToday.has(id));
  if (!atRiskIds.length) return [];

  const since = new Date(today.getTime() - 90 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const { data: actRows, error: actErr } = await admin
    .from("study_daily_activity")
    .select("user_id, activity_date, did_practice")
    .in("user_id", atRiskIds)
    .gte("activity_date", since)
    .eq("did_practice", true)
    .order("activity_date", { ascending: false });

  if (actErr) return [];

  const streakByUser = new Map<string, number>();
  for (const userId of atRiskIds) {
    const practicedDays = new Set(
      (actRows ?? [])
        .filter((row) => row.user_id === userId)
        .map((row) => row.activity_date)
    );

    let streak = 0;
    let cursor = new Date(yesterday);
    for (let i = 0; i < 90; i++) {
      const key = cursor.toISOString().slice(0, 10);
      if (practicedDays.has(key)) {
        streak++;
        cursor = new Date(cursor.getTime() - 86_400_000);
      } else {
        break;
      }
    }

    if (streak > 0) {
      streakByUser.set(userId, streak);
    }
  }

  const streakUserIds = atRiskIds.filter((id) => (streakByUser.get(id) ?? 0) > 0);
  if (!streakUserIds.length) return [];

  const { data: prefRows, error: prefErr } = await admin
    .from("study_preferences")
    .select("user_id, whatsapp_phone, whatsapp_notify")
    .in("user_id", streakUserIds)
    .eq("whatsapp_notify", true)
    .not("whatsapp_phone", "is", null);

  if (prefErr || !prefRows?.length) return [];

  return prefRows
    .filter((row) => Boolean(row.whatsapp_phone))
    .map((row) => ({
      user_id: row.user_id,
      whatsapp_phone: row.whatsapp_phone as string,
      streak: streakByUser.get(row.user_id) ?? 1,
    }))
    .slice(0, SEND_LIMIT);
}

async function sendReminderToUser(
  user: AtRiskRow,
  token: string,
  phoneNumberId: string
): Promise<SendResult> {
  try {
    const result = await sendWhatsApp(
      user.whatsapp_phone,
      user.streak,
      token,
      phoneNumberId
    );

    return {
      phone: user.whatsapp_phone.slice(0, -4) + "****",
      ok: result.ok,
      waMessageId: result.messageId,
      error: result.error,
    };
  } catch (error: unknown) {
    return {
      phone: user.whatsapp_phone.slice(0, -4) + "****",
      ok: false,
      error: error instanceof Error ? error.message : "unknown",
    };
  }
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

  const waToken = process.env.WHATSAPP_TOKEN ?? "";
  const waPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";

  if (!waToken || !waPhoneId) {
    return NextResponse.json(
      { ok: false, error: "WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set" },
      { status: 500 }
    );
  }

  let users: AtRiskRow[];
  try {
    users = await fetchAtRiskUsers();
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: `Failed to query at-risk users: ${
          error instanceof Error ? error.message : "unknown"
        }`,
      },
      { status: 500 }
    );
  }

  if (!users.length) {
    return NextResponse.json({ ok: true, sent: 0, skipped: 0, errors: [] });
  }

  console.log(`[streak-reminder] Processing ${users.length} users`);

  const limit = pLimit(5);
  const results = await Promise.all(
    users.map((user) => limit(() => sendReminderToUser(user, waToken, waPhoneId)))
  );

  const sent = results.filter((result) => result.ok).length;
  const errors = results
    .filter((result) => !result.ok)
    .map((result) => ({ phone: result.phone, error: result.error }));

  return NextResponse.json({
    ok: true,
    sent,
    skipped: users.length - sent,
    errors,
  });
}

export { POST as GET };
