import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

function parsePair(pair: string) {
  if (pair.includes('/')) {
    const [base, quote] = pair.split('/');
    return { base: base?.trim().toUpperCase(), quote: quote?.trim().toUpperCase() };
  }
  if (pair.endsWith('USDT')) {
    return { base: pair.slice(0, -4).toUpperCase(), quote: 'USDT' };
  }
  return { base: pair.slice(0, 3).toUpperCase(), quote: pair.slice(3).toUpperCase() };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = String(searchParams.get('user_id') ?? '').trim();
  const status = String(searchParams.get('status') ?? '').trim().toLowerCase();
  if (!userId) {
    return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
  }

  let query = supabaseAdmin.from('orders').select('*').eq('user_id', userId);
  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query.order('created_at', { ascending: false }).limit(200);
  if (error) {
    return NextResponse.json({ error: 'Failed to load orders' }, { status: 500 });
  }

  return NextResponse.json({ orders: data ?? [] });
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const userId = String(body?.user_id ?? '').trim();
  const pair = String(body?.pair ?? '').trim().toUpperCase();
  const side = String(body?.side ?? '').trim().toLowerCase();
  const orderType = String(body?.order_type ?? '').trim().toLowerCase();
  const base = body?.base ? String(body.base).trim().toUpperCase() : null;
  const quote = body?.quote ? String(body.quote).trim().toUpperCase() : null;
  const amount = Number(body?.amount ?? 0);
  const price = body?.price ? Number(body.price) : null;

  if (!userId || !pair || !side || !orderType) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (!['buy', 'sell'].includes(side)) {
    return NextResponse.json({ error: 'Invalid side' }, { status: 400 });
  }
  if (!['market', 'limit'].includes(orderType)) {
    return NextResponse.json({ error: 'Invalid order type' }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  }
  if (!Number.isFinite(price ?? 0) || (price ?? 0) <= 0) {
    if (orderType === 'limit') {
      return NextResponse.json({ error: 'Invalid price' }, { status: 400 });
    }
  }

  const resolved = base && quote ? { base, quote } : parsePair(pair);
  const lockedAsset = side === 'buy' ? resolved.quote : resolved.base;
  const priceForLock = Number.isFinite(price ?? 0) ? (price as number) : 0;
  const lockedAmount = side === 'buy' ? amount * priceForLock : amount;
  if (!Number.isFinite(lockedAmount) || lockedAmount <= 0) {
    return NextResponse.json({ error: 'Invalid locked amount' }, { status: 400 });
  }

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
  if (available < lockedAmount) {
    return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .insert({
      user_id: userId,
      pair,
      side,
      order_type: orderType,
      price: Number.isFinite(price ?? 0) ? price : null,
      amount,
      locked_asset: lockedAsset,
      locked_amount: lockedAmount,
    })
    .select('*')
    .single();

  if (orderError) {
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }

  const { error: balanceUpdateError } = await supabaseAdmin.from('balances').upsert(
    {
      user_id: userId,
      asset: lockedAsset,
      account_type: 'spot',
      available: available - lockedAmount,
      locked: locked + lockedAmount,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,asset,account_type' },
  );

  if (balanceUpdateError) {
    return NextResponse.json({ error: 'Failed to lock balance' }, { status: 500 });
  }

  await supabaseAdmin.from('ledger_entries').insert({
    user_id: userId,
    asset: lockedAsset,
    amount: lockedAmount,
    entry_type: 'lock',
    reference_type: 'order',
    reference_id: order.id,
    metadata: { pair, side, order_type: orderType },
  });

  return NextResponse.json({ order });
}
