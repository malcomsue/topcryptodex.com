import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

const CRON_SECRET = process.env.CRON_SECRET;
const XRPL_WS_URL = process.env.XRPL_WS_URL ?? 'wss://s2.ripple.com';
const XRP_SHARED_ADDRESS = process.env.NEXT_PUBLIC_DEPOSIT_XRP_ADDRESS ?? '';

function authOk(request: Request) {
  if (!CRON_SECRET) return true;
  const header = request.headers.get('x-cron-secret') ?? '';
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? '';
  return header === CRON_SECRET || token === CRON_SECRET;
}

async function fetchRecentXrpTxs() {
  if (!XRPL_WS_URL || !XRP_SHARED_ADDRESS) return [];
  const httpUrl = process.env.XRPL_HTTP_URL ??
    XRPL_WS_URL.replace('wss://', 'https://').replace('ws://', 'http://');
  const res = await fetch(httpUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'account_tx',
      params: [
        {
          account: XRP_SHARED_ADDRESS,
          limit: 50,
        },
      ],
    }),
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json?.result?.transactions ?? [];
}

export async function POST(request: Request) {
  if (!authOk(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!XRP_SHARED_ADDRESS) {
    return NextResponse.json({ error: 'Missing NEXT_PUBLIC_DEPOSIT_XRP_ADDRESS' }, { status: 400 });
  }

  const { data: users, error } = await supabaseAdmin
    .from('xrp_destination_tags')
    .select('user_id, destination_tag');

  if (error) {
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 });
  }

  const tagMap = new Map<number, string>();
  for (const user of users ?? []) {
    if (typeof user.destination_tag === 'number') {
      tagMap.set(user.destination_tag, user.user_id);
    }
  }

  const txs = await fetchRecentXrpTxs();
  let inserted = 0;

  for (const item of txs) {
    const tx = item?.tx;
    if (!tx || tx.TransactionType !== 'Payment') continue;
    if (String(tx.Destination ?? '') !== XRP_SHARED_ADDRESS) continue;
    const tag = Number(tx.DestinationTag);
    if (!Number.isFinite(tag)) continue;
    const userId = tagMap.get(tag);
    if (!userId) continue;

    const amountDrops = tx.Amount;
    if (typeof amountDrops !== 'string') continue;
    const amount = (Number(amountDrops) / 1_000_000).toString();

    const { error: upsertError } = await supabaseAdmin.from('deposits').upsert(
      {
        user_id: userId,
        chain: 'xrp',
        asset: 'XRP',
        to_address: XRP_SHARED_ADDRESS,
        from_address: tx.Account,
        tx_hash: tx.hash,
        amount,
        status: item?.validated ? 'confirmed' : 'detected',
        confirmations: item?.validated ? 1 : 0,
        destination_tag: String(tag),
        metadata: {
          ledger_index: item?.ledger_index,
        },
        detected_at: tx.date ? new Date((tx.date + 946684800) * 1000).toISOString() : null,
        confirmed_at: item?.validated ? new Date((tx.date + 946684800) * 1000).toISOString() : null,
      },
      { onConflict: 'chain,tx_hash' },
    );

    if (!upsertError) inserted += 1;
  }

  return NextResponse.json({
    ok: true,
    transactions: txs.length,
    inserted,
  });
}
