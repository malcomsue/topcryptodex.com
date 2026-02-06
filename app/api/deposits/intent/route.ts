import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

type DepositIntent = {
  user_id?: string | null;
  chain: 'evm' | 'tron' | 'bitcoin' | 'xrp';
  asset: string;
  to_address: string;
  from_address?: string | null;
  tx_hash?: string | null;
  amount?: string | number | null;
  destination_tag?: string | null;
  metadata?: Record<string, unknown>;
};

export async function POST(req: Request) {
  let body: DepositIntent;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.chain || !body.asset || !body.to_address) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // NOTE: This is a v1 implementation. It records deposit intents but does not yet verify
  // Privy authentication server-side. Add JWT verification before production.
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('deposits')
    .insert([
      {
        user_id: body.user_id ?? null,
        chain: body.chain,
        asset: body.asset,
        to_address: body.to_address,
        from_address: body.from_address ?? null,
        tx_hash: body.tx_hash ?? null,
        amount: body.amount ?? null,
        destination_tag: body.destination_tag ?? null,
        metadata: body.metadata ?? {},
        status: body.tx_hash ? 'pending' : 'pending',
      },
    ])
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ id: data.id }, { status: 200 });
}

