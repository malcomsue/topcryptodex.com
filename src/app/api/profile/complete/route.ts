import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const userId = String(body?.user_id ?? '').trim();
  if (!userId) {
    return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
  }

  const fullName = body?.full_name ? String(body.full_name).trim() : null;
  const email = body?.email ? String(body.email).trim().toLowerCase() : null;
  const phone = body?.phone ? String(body.phone).trim() : null;
  const documentUrl = body?.kyc_document_url ? String(body.kyc_document_url).trim() : null;
  const documentType = body?.kyc_document_type ? String(body.kyc_document_type).trim() : null;

  const { error } = await supabaseAdmin.from('user_profiles').upsert(
    {
      id: userId,
      full_name: fullName,
      email,
      phone,
      kyc_document_url: documentUrl,
      kyc_document_type: documentType,
      kyc_status: documentUrl ? 'submitted' : 'pending',
      kyc_submitted_at: documentUrl ? new Date().toISOString() : null,
      profile_completed: Boolean(fullName && (email || phone) && documentUrl),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (error) {
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
