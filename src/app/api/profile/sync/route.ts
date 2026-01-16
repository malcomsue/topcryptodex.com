import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
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

  const email = body?.email ? String(body.email).trim().toLowerCase() : null;
  const phone = body?.phone ? String(body.phone).trim() : null;
  const fullName = body?.full_name ? String(body.full_name).trim() : null;

  const payload: Record<string, any> = {
    id: userId,
    email,
    phone,
    updated_at: new Date().toISOString(),
  };

  if (fullName) {
    payload.full_name = fullName;
  }

  const { error } = await supabaseAdmin.from('user_profiles').upsert(payload, { onConflict: 'id' });

  if (error) {
    return NextResponse.json({ error: 'Failed to sync profile' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Server error', hint: 'Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY' },
      { status: 500 },
    );
  }
}
