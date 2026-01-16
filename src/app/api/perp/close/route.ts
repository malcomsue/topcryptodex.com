import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const userId = String(body?.user_id ?? '').trim();
  const positionId = String(body?.position_id ?? '').trim();
  const exitPrice = Number(body?.exit_price ?? 0);
  if (!userId || !positionId) {
    return NextResponse.json({ error: 'Missing user_id or position_id' }, { status: 400 });
  }

  const { data: position, error } = await supabaseAdmin
    .from('perp_positions')
    .select('*')
    .eq('id', positionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'Failed to load position' }, { status: 500 });
  }
  if (!position) {
    return NextResponse.json({ error: 'Position not found' }, { status: 404 });
  }
  if (position.status !== 'open') {
    return NextResponse.json({ error: 'Position not open' }, { status: 400 });
  }

  const margin = Number(position.margin ?? 0);
  const marginAsset = String(position.margin_asset ?? 'USDT');

  const { data: balanceRow, error: balanceError } = await supabaseAdmin
    .from('balances')
    .select('available, locked')
    .eq('user_id', userId)
    .eq('asset', marginAsset)
    .eq('account_type', 'perp')
    .maybeSingle();

  if (balanceError) {
    return NextResponse.json({ error: 'Failed to load balances' }, { status: 500 });
  }

  const available = Number(balanceRow?.available ?? 0);
  const locked = Number(balanceRow?.locked ?? 0);

  const { error: updateError } = await supabaseAdmin
    .from('perp_positions')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .eq('id', positionId)
    .eq('user_id', userId)
    .eq('status', 'open');

  if (updateError) {
    return NextResponse.json({ error: 'Failed to close position' }, { status: 500 });
  }

  const { error: balanceUpdateError } = await supabaseAdmin.from('balances').upsert(
    {
      user_id: userId,
      asset: marginAsset,
      account_type: 'perp',
      available: available + margin,
      locked: Math.max(0, locked - margin),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,asset,account_type' },
  );

  if (balanceUpdateError) {
    return NextResponse.json({ error: 'Failed to unlock margin' }, { status: 500 });
  }

  await supabaseAdmin.from('ledger_entries').insert({
    user_id: userId,
    asset: marginAsset,
    amount: margin,
    entry_type: 'unlock',
    reference_type: 'perp_position',
    reference_id: positionId,
    metadata: { action: 'close', exit_price: Number.isFinite(exitPrice) ? exitPrice : null },
  });

  return NextResponse.json({ ok: true });
}
