import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
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
  const admin = isAuthorized(request);
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const userId = String(body?.user_id ?? '').trim();
  const asset = String(body?.asset ?? '').trim().toUpperCase();
  const fromAccount = String(body?.from_account ?? 'funding').trim().toLowerCase();
  const toAccount = String(body?.to_account ?? 'spot').trim().toLowerCase();
  const amount = Number(body?.amount ?? 0);

  if (!userId || !asset) {
    return NextResponse.json({ error: 'Missing user_id or asset' }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  }
  if (!fromAccount || !toAccount || fromAccount === toAccount) {
    return NextResponse.json({ error: 'Invalid account transfer' }, { status: 400 });
  }

  const { data: balances, error } = await supabaseAdmin
    .from('balances')
    .select('account_type, available, locked')
    .eq('user_id', userId)
    .eq('asset', asset)
    .in('account_type', [fromAccount, toAccount]);

  if (error) {
    return NextResponse.json({ error: 'Failed to load balances' }, { status: 500 });
  }

  const fromRow = (balances ?? []).find((row) => row.account_type === fromAccount);
  const toRow = (balances ?? []).find((row) => row.account_type === toAccount);

  const fromAvailable = Number(fromRow?.available ?? 0);
  const fromLocked = Number(fromRow?.locked ?? 0);
  const toAvailable = Number(toRow?.available ?? 0);
  const toLocked = Number(toRow?.locked ?? 0);

  if (fromAvailable < amount) {
    return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
  }

  const transferId = crypto.randomUUID();

  const { error: fromError } = await supabaseAdmin.from('balances').upsert(
    {
      user_id: userId,
      asset,
      account_type: fromAccount,
      available: fromAvailable - amount,
      locked: fromLocked,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,asset,account_type' },
  );

  if (fromError) {
    return NextResponse.json({ error: 'Failed to update source balance' }, { status: 500 });
  }

  const { error: toError } = await supabaseAdmin.from('balances').upsert(
    {
      user_id: userId,
      asset,
      account_type: toAccount,
      available: toAvailable + amount,
      locked: toLocked,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,asset,account_type' },
  );

  if (toError) {
    return NextResponse.json({ error: 'Failed to update destination balance' }, { status: 500 });
  }

  const { error: ledgerError } = await supabaseAdmin.from('ledger_entries').insert([
    {
      user_id: userId,
      asset,
      amount,
      entry_type: 'debit',
      reference_type: 'transfer',
      reference_id: transferId,
      metadata: { from_account: fromAccount, to_account: toAccount, initiated_by: admin ? 'admin' : 'user' },
    },
    {
      user_id: userId,
      asset,
      amount,
      entry_type: 'credit',
      reference_type: 'transfer',
      reference_id: transferId,
      metadata: { from_account: fromAccount, to_account: toAccount, initiated_by: admin ? 'admin' : 'user' },
    },
  ]);

  if (ledgerError) {
    return NextResponse.json({ error: 'Failed to write ledger entry' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    transfer_id: transferId,
    from_account: fromAccount,
    to_account: toAccount,
    amount,
    asset,
  });
}
