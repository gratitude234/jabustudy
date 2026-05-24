// lib/studyAdmin/notifyUploader.ts
//
// Fire-and-forget notification helpers for study material review decisions.
// All functions swallow errors — a failed notification must never block the
// actual approval/rejection action or surface a 500 to the admin.

import { createSupabaseAdminClient } from "../supabase/admin";
import { sendUserPushIfAllowed } from "../webPush";
import { sendMaterialApprovedEmail, sendMaterialRejectedEmail } from "../email";

/**
 * Notify a single uploader that their material was approved.
 */
export async function notifyMaterialApproved(
  materialId: string,
  title: string,
  uploaderId: string
): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const notifTitle = "Your material was approved ✅";
    const body = `"${title}" is now live in the Study Hub and available for download.`;
    const href = `/study/materials?highlight=${encodeURIComponent(materialId)}`;

    await admin.from("notifications").insert({
      user_id: uploaderId,
      type: "material_approved",
      title: notifTitle,
      body,
      href,
      is_read: false,
    });

    void sendUserPushIfAllowed(uploaderId, { title: notifTitle, body, href, tag: `mat-approved-${materialId}` }, 'materials');
    void sendMaterialApprovedEmail({ uploaderId, title, courseCode: null, materialId });
  } catch {
    // Notification failure must never break the approval flow
  }
}

/**
 * Notify a single uploader that their material was rejected.
 */
export async function notifyMaterialRejected(
  materialId: string,
  title: string,
  uploaderId: string,
  note?: string
): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const body = note
      ? `Reason: ${note}`
      : `"${title}" was reviewed and not approved. You can re-upload with corrections.`;
    const notifTitle = "Material not approved";
    const href = `/study/materials/upload`;

    await admin.from("notifications").insert({
      user_id: uploaderId,
      type: "material_rejected",
      title: notifTitle,
      body,
      href,
      is_read: false,
    });

    void sendUserPushIfAllowed(uploaderId, { title: notifTitle, body, href, tag: `mat-rejected-${materialId}` }, 'materials');
    void sendMaterialRejectedEmail({ uploaderId, title, note });
  } catch {
    // Notification failure must never break the rejection flow
  }
}

/**
 * Notify one or more uploaders after a bulk approval.
 * Groups by uploader so each person gets a single notification even if
 * multiple of their materials were approved in the same batch.
 */
export async function notifyBulkMaterialsApproved(
  materials: Array<{ id: string; title: string; uploader_id: string | null }>
): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();

    // Group by uploader, skipping rows with no uploader_id
    const byUploader = new Map<string, typeof materials>();
    for (const m of materials) {
      if (!m.uploader_id) continue;
      if (!byUploader.has(m.uploader_id)) byUploader.set(m.uploader_id, []);
      byUploader.get(m.uploader_id)!.push(m);
    }

    if (!byUploader.size) return;

    const rows = Array.from(byUploader.entries()).map(([uploaderId, items]) => {
      const count = items.length;
      const firstName = `"${items[0].title}"`;
      const title =
        count === 1
          ? "Your material was approved ✅"
          : `${count} of your materials were approved ✅`;
      const body =
        count === 1
          ? `${firstName} is now live in the Study Hub.`
          : `${firstName} and ${count - 1} other${count - 1 === 1 ? "" : "s"} are now live in the Study Hub.`;

      return {
        user_id: uploaderId,
        type: "material_approved",
        title,
        body,
        href: `/study/materials`,
        is_read: false,
      };
    });

    await admin.from("notifications").insert(rows);

    void Promise.allSettled(
      rows.map((r) =>
        sendUserPushIfAllowed(r.user_id, { title: r.title, body: r.body, href: r.href, tag: `mat-bulk-approved-${r.user_id}` }, 'materials')
      )
    );
  } catch {
    // Notification failure must never break the bulk approval flow
  }
}
