import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = String(searchParams.get('user_id') ?? '').trim();
  const status = String(searchParams.get('status') ?? '').trim().toLowerCase();
  if (!userId) {
    return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
  }

  let query = supabaseAdmin.from('perp_positions').select('*').eq('user_id', userId);
  if (status) query = query.eq('status', status);

  const { data, error } = await query.order('created_at', { ascending: false }).limit(200);
  if (error) {
    return NextResponse.json({ error: 'Failed to load positions' }, { status: 500 });
  }

  return NextResponse.json({ positions: data ?? [] });
}
