import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type NotificationPayload = {
  user_id: string;
  type: string;
  title: string;
  body: string;
  href: string;
  is_read?: boolean;
};

type NotificationInsertMeta = {
  route: string;
  userId?: string | null;
  type?: string | null;
};

export async function insertNotificationBestEffort(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  payload: NotificationPayload | NotificationPayload[],
  meta: NotificationInsertMeta
) {
  const { error } = await admin.from("notifications").insert(payload);

  if (error) {
    console.error("[notifications] Insert failed:", error.message, {
      route: meta.route,
      userId: meta.userId ?? null,
      type: meta.type ?? null,
    });
  }
}
