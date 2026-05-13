// POST — Toggle an upvote on a study material.
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorised' }, { status: 401 });

  const { id: materialId } = await params;
  const admin = createSupabaseAdminClient();

  // Block self-rating
  const { data: matCheck } = await admin
    .from('study_materials')
    .select('uploader_id, approved')
    .eq('id', materialId)
    .maybeSingle();

  if (!matCheck) {
    return NextResponse.json({ ok: false, error: "Material not found" }, { status: 404 });
  }

  if (!(matCheck as any).approved) {
    return NextResponse.json({ ok: false, error: "Material is not available for voting" }, { status: 403 });
  }

  if ((matCheck as any)?.uploader_id && (matCheck as any).uploader_id === user.id) {
    return NextResponse.json({ ok: false, error: 'You cannot vote on your own material' }, { status: 403 });
  }

  // Atomic toggle via RPC
  const { data: rpcResult, error: rpcErr } = await admin.rpc('toggle_material_vote', {
    p_material_id: materialId,
    p_user_id: user.id,
  });

  if (rpcErr) {
    return NextResponse.json({ ok: false, error: rpcErr.message }, { status: 500 });
  }

  const voted = (rpcResult as any)?.voted ?? false;
  return NextResponse.json({ ok: true, voted });
}
