import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = String(searchParams.get('user_id') ?? '').trim();
  const accountType = String(searchParams.get('account_type') ?? 'funding').trim().toLowerCase();
  if (!userId) {
    return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
  }
  if (!accountType) {
    return NextResponse.json({ error: 'Missing account_type' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('balances')
    .select('asset, available, locked, account_type')
    .eq('user_id', userId);

  if (error) {
    return NextResponse.json({ error: 'Failed to load balances' }, { status: 500 });
  }

  const filtered = (data ?? []).filter((row) => String(row.account_type ?? '').toLowerCase() === accountType);
  return NextResponse.json({ balances: filtered });
}
