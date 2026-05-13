// app/api/vendor/bank-details/route.ts
// PATCH — update bank account details for the authenticated vendor

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

function jsonError(msg: string, status = 400, code?: string) {
  return NextResponse.json({ ok: false, code, message: msg }, { status })
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return jsonError('Unauthenticated', 401, 'unauthenticated')

    const body = await req.json().catch(() => null) as {
      bank_name?: string
      bank_account_number?: string
      bank_account_name?: string
    } | null

    if (!body) return jsonError('No body', 400, 'bad_request')

    // Validate account number is exactly 10 digits if provided
    if (body.bank_account_number) {
      if (!/^\d{10}$/.test(body.bank_account_number)) {
        return jsonError('Account number must be exactly 10 digits', 400, 'invalid_account_number')
      }
    }

    const admin = createSupabaseAdminClient()
    const { data: vendor } = await admin
      .from('vendors')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!vendor) return jsonError('Vendor not found', 404, 'not_found')

    const patch: Record<string, string | null> = {}
    if (body.bank_name !== undefined) patch.bank_name = body.bank_name || null
    if (body.bank_account_number !== undefined) patch.bank_account_number = body.bank_account_number || null
    if (body.bank_account_name !== undefined) patch.bank_account_name = body.bank_account_name || null

    if (Object.keys(patch).length === 0) return jsonError('No fields to update', 400, 'empty_patch')

    const { error } = await admin
      .from('vendors')
      .update(patch)
      .eq('id', vendor.id)

    if (error) return jsonError(error.message, 500, 'update_failed')

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
