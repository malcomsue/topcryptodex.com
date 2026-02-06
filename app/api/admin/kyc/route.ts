import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

const ALLOWED_STATUSES = new Set(['pending', 'approved', 'rejected']);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = String(searchParams.get('q') ?? '').trim();
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '50')));

  let query = supabaseAdmin
    .from('user_profiles')
    .select('id, full_name, email, phone, kyc_status, kyc_document_url, kyc_document_type, kyc_submitted_at')
    .not('kyc_document_url', 'is', null)
    .order('kyc_submitted_at', { ascending: false })
    .limit(limit);

  if (q) {
    const escaped = q.replace(/%/g, '\\%').replace(/_/g, '\\_');
    query = query.or(
      `full_name.ilike.%${escaped}%,email.ilike.%${escaped}%,phone.ilike.%${escaped}%,id.ilike.%${escaped}%`,
    );
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'Failed to load KYC submissions' }, { status: 500 });
  }

  return NextResponse.json({ users: data ?? [] });
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const userId = String(body?.user_id ?? '').trim();
  const status = String(body?.status ?? '').trim().toLowerCase();

  if (!userId) {
    return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
  }
  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('user_profiles')
    .update({ kyc_status: status, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    return NextResponse.json({ error: 'Failed to update KYC status' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
