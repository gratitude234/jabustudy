// app/api/vendor/avatar/route.ts
// Returns a signed upload URL so the browser can PUT the image directly to
// Supabase Storage without routing the binary through Next.js.
//
// STORAGE SETUP (run once in Supabase dashboard or SQL editor):
//
//   -- Create bucket (public so avatar URLs work without auth)
//   INSERT INTO storage.buckets (id, name, public)
//   VALUES ('vendor-avatars', 'vendor-avatars', true)
//   ON CONFLICT (id) DO NOTHING;
//
//   -- Allow authenticated vendors to upload their own avatar
//   CREATE POLICY "vendor upload own avatar"
//   ON storage.objects FOR INSERT TO authenticated
//   WITH CHECK (bucket_id = 'vendor-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
//
//   -- Public read
//   CREATE POLICY "public read vendor avatars"
//   ON storage.objects FOR SELECT TO public
//   USING (bucket_id = 'vendor-avatars');

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const BUCKET = 'vendor-avatars';
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

function jsonError(msg: string, status = 400, code?: string) {
  return NextResponse.json({ ok: false, code, message: msg }, { status });
}

export async function POST(req: Request) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonError('Unauthenticated', 401, 'unauthenticated');

    const admin = createSupabaseAdminClient();

    // ── Resolve vendor ────────────────────────────────────────────────────────
    const { data: vendor } = await admin
      .from('vendors')
      .select('id')
      .eq('user_id', user.id)
      .eq('vendor_type', 'food')
      .maybeSingle();

    if (!vendor) return jsonError('Not a food vendor', 403, 'not_vendor');

    // ── Parse request ─────────────────────────────────────────────────────────
    const body = await req.json().catch(() => null) as { ext?: string; size?: number } | null;
    const rawExt = (body?.ext ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const ext = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(rawExt) ? rawExt : 'jpg';

    if (typeof body?.size === 'number' && body.size > MAX_BYTES) {
      return jsonError(`File too large — max 2 MB`, 400, 'file_too_large');
    }

    // ── Sign upload URL ───────────────────────────────────────────────────────
    // Path: {vendorId}/avatar.{ext}  — overwrites previous avatar automatically
    const filePath = `${vendor.id}/avatar.${ext}`;
    const storageRef = admin.storage.from(BUCKET) as any;

    if (typeof storageRef.createSignedUploadUrl !== 'function') {
      return jsonError('Storage client too old — update @supabase/supabase-js', 500, 'storage_error');
    }

    const { data: signed, error: signErr } = await storageRef.createSignedUploadUrl(filePath);
    if (signErr || !signed) {
      return jsonError(signErr?.message ?? 'Failed to create upload URL', 500, 'sign_failed');
    }

    // Public URL is deterministic — no need to call getPublicUrl after upload
    const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filePath}`;

    return NextResponse.json({
      ok: true,
      signedUrl: signed.signedUrl,
      token: signed.token,
      path: filePath,
      publicUrl,
    });

  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? 'Server error' }, { status: 500 });
  }
}