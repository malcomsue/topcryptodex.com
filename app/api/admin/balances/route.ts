import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

function isAuthorized(request: Request) {
  if (!ADMIN_TOKEN) return false;
  const header = request.headers.get('x-admin-token') ?? '';
  const token = new URL(request.url).searchParams.get('token') ?? '';
  return header === ADMIN_TOKEN || token === ADMIN_TOKEN;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const userId = String(body?.user_id ?? '').trim();
  const asset = String(body?.asset ?? '').trim().toUpperCase();
  const accountType = String(body?.account_type ?? 'funding').trim().toLowerCase();
  const available = Number(body?.available ?? 0);
  const locked = Number(body?.locked ?? 0);

  if (!userId || !asset) {
    return NextResponse.json({ error: 'Missing user_id or asset' }, { status: 400 });
  }
  if (!Number.isFinite(available) || !Number.isFinite(locked)) {
    return NextResponse.json({ error: 'Invalid balance amounts' }, { status: 400 });
  }

  const { error: upsertError } = await supabaseAdmin.from('balances').upsert(
    {
      user_id: userId,
      asset,
      account_type: accountType,
      available,
      locked,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,asset,account_type' },
  );

  if (upsertError) {
    return NextResponse.json({ error: 'Failed to update balance' }, { status: 500 });
  }

  const { error: ledgerError } = await supabaseAdmin.from('ledger_entries').insert({
    user_id: userId,
    asset,
    amount: available + locked,
    entry_type: 'adjustment',
    reference_type: 'admin',
    reference_id: 'manual',
    metadata: { available, locked, account_type: accountType },
  });

  if (ledgerError) {
    return NextResponse.json({ error: 'Failed to write ledger entry' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
