import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAuth, unauthorizedResponse } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  // Verify authentication
  let authResult;
  try {
    authResult = await verifyAuth(request);
  } catch (error: any) {
    return unauthorizedResponse(error.message);
  }

  const { searchParams } = new URL(request.url);
  const accountType = String(searchParams.get('account_type') ?? '').trim().toLowerCase();

  let query = supabaseAdmin
    .from('balances')
    .select('asset, available, locked, account_type')
    .eq('user_id', authResult.userId);

  if (accountType) {
    query = query.eq('account_type', accountType);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'Failed to load balances' }, { status: 500 });
  }

  return NextResponse.json({ balances: data ?? [] });
}
