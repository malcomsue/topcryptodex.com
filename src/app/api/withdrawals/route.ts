import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAuth, unauthorizedResponse } from '@/lib/auth';

export const runtime = 'nodejs';

const FEE_RATE = 0.001; // 0.1% fee
const SUPPORTED_ASSETS = new Set(['BTC', 'ETH', 'USDT', 'SOL', 'XRP']);
const MIN_WITHDRAWAL: Record<string, number> = {
  BTC: 0.0001,
  ETH: 0.001,
  USDT: 10,
  SOL: 0.1,
  XRP: 10,
};

// GET: Fetch user's withdrawal history
export async function GET(request: Request) {
  let authResult;
  try {
    authResult = await verifyAuth(request);
  } catch (error: any) {
    return unauthorizedResponse(error.message);
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '50')));

  let query = supabaseAdmin
    .from('withdrawals')
    .select('*')
    .eq('user_id', authResult.userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'Failed to load withdrawals' }, { status: 500 });
  }

  return NextResponse.json({ withdrawals: data ?? [] });
}

// POST: Create new withdrawal request
export async function POST(request: Request) {
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

  const asset = String(body?.asset ?? '').trim().toUpperCase();
  const amount = Number(body?.amount ?? 0);
  const address = String(body?.address ?? '').trim();

  // Validation
  if (!SUPPORTED_ASSETS.has(asset)) {
    return NextResponse.json({ error: 'Unsupported asset' }, { status: 400 });
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  }

  const minAmount = MIN_WITHDRAWAL[asset] ?? 0;
  if (amount < minAmount) {
    return NextResponse.json(
      { error: `Minimum withdrawal for ${asset} is ${minAmount}` },
      { status: 400 }
    );
  }

  if (!address || address.length < 10) {
    return NextResponse.json({ error: 'Invalid withdrawal address' }, { status: 400 });
  }

  const fee = Math.max(amount * FEE_RATE, 0.0001); // Minimum fee
  const totalRequired = amount + fee;

  // Check balance (don't lock it yet - that happens on approval)
  const { data: balanceRow, error: balanceError } = await supabaseAdmin
    .from('balances')
    .select('available')
    .eq('user_id', authResult.userId)
    .eq('asset', asset)
    .eq('account_type', 'funding')
    .maybeSingle();

  if (balanceError) {
    return NextResponse.json({ error: 'Failed to check balance' }, { status: 500 });
  }

  const available = Number(balanceRow?.available ?? 0);
  if (available < totalRequired) {
    return NextResponse.json(
      {
        error: 'Insufficient balance',
        available,
        required: totalRequired,
        amount,
        fee,
      },
      { status: 400 }
    );
  }

  // Create pending withdrawal request
  const { data: withdrawal, error: insertError } = await supabaseAdmin
    .from('withdrawals')
    .insert({
      user_id: authResult.userId,
      asset,
      amount,
      fee,
      address,
      status: 'pending',
    })
    .select('*')
    .single();

  if (insertError) {
    console.error('Withdrawal insert error:', insertError);
    return NextResponse.json({ error: 'Failed to create withdrawal request' }, { status: 500 });
  }

  return NextResponse.json({ withdrawal });
}
