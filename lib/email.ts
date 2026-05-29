// lib/email.ts
//
// Fire-and-forget email helpers for Jabu Study transactional notifications.
// All functions swallow errors — a failed email must never break the main action.
// Uses Resend as the sending provider via notifications@jabustudy.com.

import { Resend } from "resend";
import { createSupabaseAdminClient } from "./supabase/admin";

const FROM = process.env.RESEND_FROM ?? "Jabu Study <notifications@jabustudy.com>";

function resolveSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw && !raw.startsWith("http://localhost") && !raw.startsWith("http://127.")) return raw.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  return "https://www.jabustudy.com";
}

const SITE_URL = resolveSiteUrl();

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set");
  return new Resend(key);
}

async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin.auth.admin.getUserById(userId);
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

// ─── Base layout ──────────────────────────────────────────────────────────────

function emailLayout(content: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Jabu Study</title>
</head>
<body style="margin:0;padding:0;background:#f4f3ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3ff;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom:24px;text-align:center;">
              <a href="${SITE_URL}" style="text-decoration:none;">
                <span style="display:inline-block;background:#5B35D5;color:#fff;font-size:18px;font-weight:800;padding:10px 20px;border-radius:12px;letter-spacing:-0.3px;">
                  Jabu Study
                </span>
              </a>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:20px;text-align:center;font-size:11px;color:#9ca3af;line-height:1.6;">
              You're receiving this because you have an account on Jabu Study.<br/>
              <a href="${SITE_URL}/study/me" style="color:#9ca3af;">Manage notifications</a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function btn(label: string, href: string) {
  return `<a href="${href}" style="display:inline-block;margin-top:20px;background:#5B35D5;color:#ffffff;font-size:14px;font-weight:700;padding:12px 24px;border-radius:10px;text-decoration:none;">${label}</a>`;
}

function heading(text: string) {
  return `<h1 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#111827;line-height:1.3;">${text}</h1>`;
}

function para(text: string) {
  return `<p style="margin:0 0 12px;font-size:14px;color:#374151;line-height:1.6;">${text}</p>`;
}

function muted(text: string) {
  return `<p style="margin:8px 0 0;font-size:12px;color:#6b7280;line-height:1.5;">${text}</p>`;
}

function blockquote(text: string) {
  return `<div style="margin:16px 0;padding:12px 16px;background:#f9fafb;border-left:3px solid #5B35D5;border-radius:0 8px 8px 0;font-size:14px;color:#374151;line-height:1.5;">${text}</div>`;
}

// ─── Answer posted ─────────────────────────────────────────────────────────────

export async function sendAnswerPostedEmail({
  questionAuthorId,
  questionTitle,
  questionId,
  answerId,
}: {
  questionAuthorId: string;
  questionTitle: string;
  questionId: string;
  answerId: string;
}): Promise<void> {
  try {
    const email = await getUserEmail(questionAuthorId);
    if (!email) return;

    const href = `${SITE_URL}/study/questions/${questionId}#answer-${answerId}`;
    const short = questionTitle.length > 80 ? questionTitle.slice(0, 77) + "…" : questionTitle;

    const html = emailLayout(`
      ${heading("Your question was answered 💬")}
      ${para("Someone just posted an answer to your question on Jabu Study.")}
      ${blockquote(short)}
      ${btn("View Answer", href)}
      ${muted("Jump in to read the answer and mark it as accepted if it helped.")}
    `);

    await getResend().emails.send({
      from: FROM,
      to: email,
      subject: `Your question was answered on Jabu Study`,
      html,
    });
  } catch {
    // Email failure must never break the answer flow
  }
}

// ─── Answer accepted ───────────────────────────────────────────────────────────

export async function sendAnswerAcceptedEmail({
  answerAuthorId,
  questionTitle,
  questionId,
  answerId,
}: {
  answerAuthorId: string;
  questionTitle: string;
  questionId: string;
  answerId: string;
}): Promise<void> {
  try {
    const email = await getUserEmail(answerAuthorId);
    if (!email) return;

    const href = `${SITE_URL}/study/questions/${questionId}#answer-${answerId}`;
    const short = questionTitle.length > 80 ? questionTitle.slice(0, 77) + "…" : questionTitle;

    const html = emailLayout(`
      ${heading("Your answer was accepted ✅")}
      ${para("The question author marked your answer as the best answer. Great work!")}
      ${blockquote(short)}
      ${btn("View Question", href)}
      ${muted("Keep contributing — every accepted answer builds your reputation.")}
    `);

    await getResend().emails.send({
      from: FROM,
      to: email,
      subject: `Your answer was accepted ✅`,
      html,
    });
  } catch {
    // Email failure must never break the accept flow
  }
}

// ─── Material approved ─────────────────────────────────────────────────────────

export async function sendMaterialApprovedEmail({
  uploaderId,
  title,
  courseCode,
  materialId,
}: {
  uploaderId: string;
  title: string;
  courseCode: string | null;
  materialId: string;
}): Promise<void> {
  try {
    const email = await getUserEmail(uploaderId);
    if (!email) return;

    const href = `${SITE_URL}/study/materials/${materialId}`;
    const label = courseCode ? `${courseCode} — ${title}` : title;

    const html = emailLayout(`
      ${heading("Your material is now live ✅")}
      ${para("Your upload has been reviewed and approved. Students can now download it from the Study Hub.")}
      ${blockquote(label)}
      ${btn("View Material", href)}
      ${muted("Thank you for contributing to Jabu Study!")}
    `);

    await getResend().emails.send({
      from: FROM,
      to: email,
      subject: `Your material is now live on Jabu Study`,
      html,
    });
  } catch {
    // Email failure must never break the approval flow
  }
}

// ─── Material rejected ─────────────────────────────────────────────────────────

export async function sendMaterialRejectedEmail({
  uploaderId,
  title,
  note,
}: {
  uploaderId: string;
  title: string;
  note?: string;
}): Promise<void> {
  try {
    const email = await getUserEmail(uploaderId);
    if (!email) return;

    const href = `${SITE_URL}/study/materials/upload`;
    const reason = note ?? "It did not meet the content guidelines. Please review and re-upload with corrections.";

    const html = emailLayout(`
      ${heading("Material not approved")}
      ${para(`Your upload <strong>"${title}"</strong> was reviewed but could not be approved.`)}
      ${blockquote(`Reason: ${reason}`)}
      ${btn("Re-upload", href)}
      ${muted("If you believe this was a mistake, contact your department rep or admin.")}
    `);

    await getResend().emails.send({
      from: FROM,
      to: email,
      subject: `Your material upload wasn't approved`,
      html,
    });
  } catch {
    // Email failure must never break the rejection flow
  }
}

// ─── Rep approved ──────────────────────────────────────────────────────────────

export async function sendRepApprovedEmail({
  userId,
  role,
}: {
  userId: string;
  role: "course_rep" | "dept_librarian";
}): Promise<void> {
  try {
    const email = await getUserEmail(userId);
    if (!email) return;

    const roleLabel = role === "dept_librarian" ? "Dept Librarian" : "Course Rep";
    const href = role === "course_rep"
      ? `${SITE_URL}/study/rep-setup`
      : `${SITE_URL}/study/materials/upload`;
    const nextStep = role === "course_rep"
      ? "Start by setting up the courses your department offers."
      : "You can now upload and manage materials for your department.";

    const html = emailLayout(`
      ${heading(`You're now a ${roleLabel} on Jabu Study! 🎉`)}
      ${para("Your application has been reviewed and approved. You now have contributor access.")}
      ${para(nextStep)}
      ${btn("Get Started", href)}
      ${muted("Thank you for stepping up to help your fellow students.")}
    `);

    await getResend().emails.send({
      from: FROM,
      to: email,
      subject: `You're now a ${roleLabel} on Jabu Study! 🎉`,
      html,
    });
  } catch {
    // Email failure must never break the approval flow
  }
}

// ─── Rep rejected ──────────────────────────────────────────────────────────────

export async function sendRepRejectedEmail({
  userId,
  reason,
}: {
  userId: string;
  reason: string;
}): Promise<void> {
  try {
    const email = await getUserEmail(userId);
    if (!email) return;

    const href = `${SITE_URL}/study/apply-rep`;

    const html = emailLayout(`
      ${heading("Rep application not approved")}
      ${para("Thank you for applying. Unfortunately your application could not be approved at this time.")}
      ${blockquote(`Reason: ${reason}`)}
      ${btn("View Application", href)}
      ${muted("You're welcome to re-apply in the future. Contact your study admin for more details.")}
    `);

    await getResend().emails.send({
      from: FROM,
      to: email,
      subject: `Your Jabu Study rep application was not approved`,
      html,
    });
  } catch {
    // Email failure must never break the rejection flow
  }
}

// ─── New quiz set ──────────────────────────────────────────────────────────────

export async function sendNewQuizSetEmail({
  emails,
  setId,
  title,
  courseCode,
  questionsCount,
}: {
  emails: string[];
  setId: string;
  title: string | null;
  courseCode: string | null;
  questionsCount: number;
}): Promise<void> {
  if (!emails.length) return;
  try {
    const href = `${SITE_URL}/study/practice/${setId}`;
    const count = questionsCount;
    const qLabel = `${count} question${count === 1 ? "" : "s"}`;
    const setLabel = title ?? (courseCode ? `${courseCode} Practice Set` : "Practice Set");
    const subject = courseCode
      ? `New practice set for ${courseCode} — ${qLabel}`
      : `New practice set available — ${qLabel}`;

    const html = emailLayout(`
      ${heading("New practice set available ⚡")}
      ${para(courseCode
        ? `A new practice set for <strong>${courseCode}</strong> has been published on Jabu Study.`
        : "A new practice set has been published on Jabu Study.")}
      ${blockquote(`${setLabel} — ${qLabel} ready to practice`)}
      ${btn("Start Practising", href)}
      ${muted("Test your knowledge while the material is fresh!")}
    `);

    const resend = getResend();
    for (let i = 0; i < emails.length; i += 100) {
      const batch = emails.slice(i, i + 100).map(to => ({
        from: FROM,
        to,
        subject,
        html,
      }));
      await resend.batch.send(batch);
    }
  } catch (err) {
    console.error("[sendNewQuizSetEmail]", err);
  }
}

// ─── New material in department ────────────────────────────────────────────────

export async function sendNewMaterialEmail({
  userIds,
  title,
  courseCode,
  materialId,
}: {
  userIds: string[];
  title: string;
  courseCode: string | null;
  materialId: string;
}): Promise<void> {
  if (!userIds.length) return;
  try {
    const admin = createSupabaseAdminClient();
    const href = `${SITE_URL}/study/materials/${materialId}`;
    const label = courseCode ? `[${courseCode}] ${title}` : title;
    const subject = courseCode
      ? `New study material for ${courseCode}`
      : "New study material in your department";

    const html = emailLayout(`
      ${heading("New material available 📚")}
      ${para("A new study material has been added to your department on Jabu Study.")}
      ${blockquote(label)}
      ${btn("View Material", href)}
      ${muted("Download it while it's fresh!")}
    `);

    // Batch fetch emails for all userIds
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const idSet = new Set(userIds);
    const emails = (users?.users ?? [])
      .filter(u => idSet.has(u.id) && u.email)
      .map(u => u.email as string);

    if (!emails.length) return;

    const resend = getResend();
    // Resend batch API: up to 100 per call
    for (let i = 0; i < emails.length; i += 100) {
      const batch = emails.slice(i, i + 100).map(to => ({
        from: FROM,
        to,
        subject,
        html,
      }));
      await resend.batch.send(batch);
    }
  } catch {
    // Email failure must never block the material flow
  }
}
