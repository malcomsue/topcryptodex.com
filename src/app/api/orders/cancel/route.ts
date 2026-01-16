import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const userId = String(body?.user_id ?? '').trim();
  const orderId = String(body?.order_id ?? '').trim();
  if (!userId || !orderId) {
    return NextResponse.json({ error: 'Missing user_id or order_id' }, { status: 400 });
  }

  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'Failed to load order' }, { status: 500 });
  }
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }
  if (order.status !== 'open') {
    return NextResponse.json({ error: 'Order not open' }, { status: 400 });
  }

  const lockedAsset = String(order.locked_asset);
  const lockedAmount = Number(order.locked_amount ?? 0);

  const { data: balanceRow, error: balanceError } = await supabaseAdmin
    .from('balances')
    .select('available, locked')
    .eq('user_id', userId)
    .eq('asset', lockedAsset)
    .eq('account_type', 'spot')
    .maybeSingle();

  if (balanceError) {
    return NextResponse.json({ error: 'Failed to load balances' }, { status: 500 });
  }

  const available = Number(balanceRow?.available ?? 0);
  const locked = Number(balanceRow?.locked ?? 0);

  const { error: updateError } = await supabaseAdmin
    .from('orders')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('user_id', userId)
    .eq('status', 'open');

  if (updateError) {
    return NextResponse.json({ error: 'Failed to cancel order' }, { status: 500 });
  }

  const { error: balanceUpdateError } = await supabaseAdmin.from('balances').upsert(
    {
      user_id: userId,
      asset: lockedAsset,
      account_type: 'spot',
      available: available + lockedAmount,
      locked: Math.max(0, locked - lockedAmount),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,asset,account_type' },
  );

  if (balanceUpdateError) {
    return NextResponse.json({ error: 'Failed to unlock balance' }, { status: 500 });
  }

  await supabaseAdmin.from('ledger_entries').insert({
    user_id: userId,
    asset: lockedAsset,
    amount: lockedAmount,
    entry_type: 'unlock',
    reference_type: 'order',
    reference_id: orderId,
    metadata: { action: 'cancel' },
  });

  return NextResponse.json({ ok: true });
}
