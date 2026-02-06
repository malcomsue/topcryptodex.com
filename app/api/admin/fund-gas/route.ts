import { NextResponse } from 'next/server';
import { fundGas } from '@/lib/blockchain/ethereum';

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

  const address = String(body?.address ?? '').trim();
  if (!address || address.length < 10) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
  }

  try {
    const result = await fundGas(address);
    return NextResponse.json({
      ok: true,
      tx_hash: result.hash,
      amount: result.amount,
    });
  } catch (err: any) {
    console.error('Fund gas error:', err);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to send gas' },
      { status: 500 },
    );
  }
}
