import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendETH, sendUSDT } from '@/lib/blockchain/ethereum';

export const runtime = 'nodejs';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

function isAuthorized(request: Request) {
  if (!ADMIN_TOKEN) return false;
  const header = request.headers.get('x-admin-token') ?? '';
  const cookie = request.headers.get('cookie')?.match(/admin_auth=([^;]+)/)?.[1] ?? '';
  return header === ADMIN_TOKEN || cookie === ADMIN_TOKEN;
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

  const withdrawalId = String(body?.withdrawal_id ?? '').trim();
  if (!withdrawalId) {
    return NextResponse.json({ error: 'Missing withdrawal_id' }, { status: 400 });
  }

  // Fetch the withdrawal — must be approved (failed to send on-chain previously)
  const { data: withdrawal, error } = await supabaseAdmin
    .from('withdrawals')
    .select('id, asset, amount, address, status, tx_hash')
    .eq('id', withdrawalId)
    .single();

  if (error || !withdrawal) {
    return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 });
  }

  if (withdrawal.status !== 'approved') {
    return NextResponse.json(
      { error: `Cannot retry: withdrawal status is "${withdrawal.status}", expected "approved"` },
      { status: 400 },
    );
  }

  if (withdrawal.tx_hash) {
    return NextResponse.json(
      { error: 'Withdrawal already has a tx_hash. Check the blockchain for its status.' },
      { status: 400 },
    );
  }

  const asset = withdrawal.asset?.toUpperCase();
  if (!['ETH', 'USDT'].includes(asset)) {
    return NextResponse.json(
      { error: `On-chain retry not supported for ${asset}. Handle manually.` },
      { status: 400 },
    );
  }

  try {
    let txResult: { hash: string; gasCost: string };

    if (asset === 'ETH') {
      txResult = await sendETH(withdrawal.address, String(withdrawal.amount));
    } else {
      txResult = await sendUSDT(withdrawal.address, String(withdrawal.amount));
    }

    await supabaseAdmin
      .from('withdrawals')
      .update({
        tx_hash: txResult.hash,
        network_fee: txResult.gasCost,
        status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', withdrawalId);

    return NextResponse.json({
      ok: true,
      tx_hash: txResult.hash,
      network_fee: txResult.gasCost,
    });
  } catch (err: any) {
    console.error('Retry withdrawal on-chain error:', err);
    return NextResponse.json(
      { error: err?.message ?? 'On-chain transaction failed' },
      { status: 500 },
    );
  }
}
