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

function liquidationPrice(entry: number, leverage: number, side: 'long' | 'short') {
  const maintenance = 0.005;
  const baseMove = 1 / leverage;
  if (side === 'long') {
    return Math.max(0, entry * (1 - baseMove + maintenance));
  }
  return Math.max(0, entry * (1 + baseMove - maintenance));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = String(searchParams.get('user_id') ?? '').trim();
  const status = String(searchParams.get('status') ?? '').trim().toLowerCase();
  if (!userId) {
    return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
  }

  let query = supabaseAdmin.from('perp_orders').select('*').eq('user_id', userId);
  if (status) query = query.eq('status', status);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(200);
  if (error) {
    return NextResponse.json({ error: 'Failed to load perp orders' }, { status: 500 });
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
  const side = String(body?.side ?? '').trim().toLowerCase() as 'long' | 'short';
  const orderType = String(body?.order_type ?? '').trim().toLowerCase();
  const amount = Number(body?.amount ?? 0);
  const leverage = Number(body?.leverage ?? 0);
  const price = Number(body?.price ?? 0);
  const takeProfit = body?.take_profit ? Number(body.take_profit) : null;
  const stopLoss = body?.stop_loss ? Number(body.stop_loss) : null;

  if (!userId || !pair) {
    return NextResponse.json({ error: 'Missing user_id or pair' }, { status: 400 });
  }
  if (!['long', 'short'].includes(side)) {
    return NextResponse.json({ error: 'Invalid side' }, { status: 400 });
  }
  if (!['market', 'limit'].includes(orderType)) {
    return NextResponse.json({ error: 'Invalid order type' }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  }
  if (!Number.isFinite(leverage) || leverage < 1 || leverage > 125) {
    return NextResponse.json({ error: 'Invalid leverage' }, { status: 400 });
  }
  if (!Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ error: 'Invalid price' }, { status: 400 });
  }
  if (takeProfit !== null && (!Number.isFinite(takeProfit) || takeProfit <= 0)) {
    return NextResponse.json({ error: 'Invalid take profit' }, { status: 400 });
  }
  if (stopLoss !== null && (!Number.isFinite(stopLoss) || stopLoss <= 0)) {
    return NextResponse.json({ error: 'Invalid stop loss' }, { status: 400 });
  }

  const { quote } = parsePair(pair);
  const notional = amount * price;
  const margin = notional / leverage;
  if (!Number.isFinite(notional) || notional <= 0) {
    return NextResponse.json({ error: 'Invalid notional' }, { status: 400 });
  }

  const { data: balanceRow, error: balanceError } = await supabaseAdmin
    .from('balances')
    .select('available, locked')
    .eq('user_id', userId)
    .eq('asset', quote)
    .eq('account_type', 'perp')
    .maybeSingle();

  if (balanceError) {
    return NextResponse.json({ error: 'Failed to load balances' }, { status: 500 });
  }

  const available = Number(balanceRow?.available ?? 0);
  const locked = Number(balanceRow?.locked ?? 0);
  if (available < margin) {
    return NextResponse.json({ error: 'Insufficient margin balance' }, { status: 400 });
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from('perp_orders')
    .insert({
      user_id: userId,
      pair,
      side,
      order_type: orderType,
      price,
      amount,
      leverage,
      margin,
      margin_asset: quote,
      notional,
    })
    .select('*')
    .single();

  if (orderError) {
    return NextResponse.json({ error: 'Failed to create perp order' }, { status: 500 });
  }

  const liq = liquidationPrice(price, leverage, side);

  const { data: position, error: positionError } = await supabaseAdmin
    .from('perp_positions')
    .insert({
      user_id: userId,
      order_id: order.id,
      pair,
      side,
      size: amount,
      entry_price: price,
      leverage,
      margin,
      margin_asset: quote,
      notional,
      take_profit: takeProfit,
      stop_loss: stopLoss,
      liquidation_price: liq,
    })
    .select('*')
    .single();

  if (positionError) {
    return NextResponse.json({ error: 'Failed to open position' }, { status: 500 });
  }

  const { error: balanceUpdateError } = await supabaseAdmin.from('balances').upsert(
    {
      user_id: userId,
      asset: quote,
      account_type: 'perp',
      available: available - margin,
      locked: locked + margin,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,asset,account_type' },
  );

  if (balanceUpdateError) {
    return NextResponse.json({ error: 'Failed to lock margin' }, { status: 500 });
  }

  await supabaseAdmin.from('ledger_entries').insert({
    user_id: userId,
    asset: quote,
    amount: margin,
    entry_type: 'lock',
    reference_type: 'perp_order',
    reference_id: order.id,
    metadata: { pair, side, leverage, margin_asset: quote },
  });

  return NextResponse.json({ order, position });
}
