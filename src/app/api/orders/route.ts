import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAuth, unauthorizedResponse } from '@/lib/auth';

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
  let authResult;
  try {
    authResult = await verifyAuth(request);
  } catch (error: any) {
    return unauthorizedResponse(error.message);
  }

  const { searchParams } = new URL(request.url);
  const status = String(searchParams.get('status') ?? '').trim().toLowerCase();

  let query = supabaseAdmin.from('orders').select('*').eq('user_id', authResult.userId);
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
  // Verify authentication
  let authResult;
  try {
    authResult = await verifyAuth(request);
  } catch (error: any) {
    return unauthorizedResponse(error.message);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const pair = String(body?.pair ?? '').trim().toUpperCase();
  const side = String(body?.side ?? '').trim().toLowerCase();
  const orderType = String(body?.order_type ?? '').trim().toLowerCase();
  const base = body?.base ? String(body.base).trim().toUpperCase() : null;
  const quote = body?.quote ? String(body.quote).trim().toUpperCase() : null;
  const amount = Number(body?.amount ?? 0);
  const price = body?.price ? Number(body.price) : null;

  if (!pair || !side || !orderType) {
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

  // Use atomic function for order creation
  const { data, error } = await supabaseAdmin.rpc('create_order_atomic', {
    p_user_id: authResult.userId,
    p_pair: pair,
    p_side: side,
    p_order_type: orderType,
    p_price: price ?? 0,
    p_amount: amount,
    p_locked_asset: lockedAsset,
    p_locked_amount: lockedAmount,
  });

  if (error) {
    console.error('Create order error:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  const result = data as any;
  if (result?.error) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
  }

  // Fetch the created order to return full details
  const { data: order, error: fetchError } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('id', result.order_id)
    .single();

  if (fetchError || !order) {
    return NextResponse.json({ error: 'Order created but failed to fetch details' }, { status: 500 });
  }

  return NextResponse.json({ order });
}
