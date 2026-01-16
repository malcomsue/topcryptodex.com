import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { deriveEthAddress } from '../../../../lib/ethWallet';

export const runtime = 'nodejs';

const DEFAULT_CHAIN = 'ethereum';
const DEFAULT_ASSET = 'ETH';

export async function POST(request: Request) {
  try {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const userId = String(body?.user_id ?? '').trim();
  if (!userId) {
    return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
  }

  const chain = String(body?.chain ?? DEFAULT_CHAIN).trim().toLowerCase();
  const rawAsset = String(body?.asset ?? DEFAULT_ASSET).trim().toUpperCase();
  const asset = rawAsset === 'USDT' ? 'ETH' : rawAsset;

  if (chain !== DEFAULT_CHAIN) {
    return NextResponse.json({ error: 'Unsupported chain' }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('deposit_addresses')
    .select('address, derivation_index, derivation_path')
    .eq('user_id', userId)
    .eq('chain', chain)
    .eq('asset', asset)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: 'Failed to fetch address' }, { status: 500 });
  }

  if (existing) {
    return NextResponse.json({ address: existing.address });
  }

  const { data: lastIndexRow } = await supabaseAdmin
    .from('deposit_addresses')
    .select('derivation_index')
    .eq('chain', chain)
    .order('derivation_index', { ascending: false })
    .limit(1)
    .maybeSingle();

  const startingIndex = typeof lastIndexRow?.derivation_index === 'number' ? lastIndexRow.derivation_index + 1 : 0;

  for (let offset = 0; offset < 5; offset += 1) {
    const index = startingIndex + offset;
    let derived;
    try {
      derived = deriveEthAddress(index);
    } catch (err: any) {
      return NextResponse.json(
        { error: err?.message ?? 'Failed to derive address', hint: 'Check DEPOSIT_ETH_MNEMONIC' },
        { status: 500 },
      );
    }

    const { error: insertError } = await supabaseAdmin.from('deposit_addresses').insert({
      user_id: userId,
      chain,
      asset,
      address: derived.address,
      derivation_index: derived.derivation_index,
      derivation_path: derived.derivation_path,
    });

    if (!insertError) {
      return NextResponse.json({ address: derived.address });
    }

    const isUniqueViolation =
      String((insertError as any)?.code || '').toLowerCase() === '23505' ||
      String((insertError as any)?.message || '').toLowerCase().includes('duplicate');
    if (isUniqueViolation) {
      const { data: existingAfter } = await supabaseAdmin
        .from('deposit_addresses')
        .select('address')
        .eq('user_id', userId)
        .eq('chain', chain)
        .eq('asset', asset)
        .maybeSingle();

      if (existingAfter?.address) {
        return NextResponse.json({ address: existingAfter.address });
      }
    }
  }

  return NextResponse.json({ error: 'Failed to allocate address' }, { status: 500 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Server error', hint: 'Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY' },
      { status: 500 },
    );
  }
}
