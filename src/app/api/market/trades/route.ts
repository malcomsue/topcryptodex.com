import { NextResponse } from 'next/server';
import { fetchBinanceJson, getSymbolFromUrl, jsonError } from '../_utils';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const symbol = getSymbolFromUrl(request.url);
  if (!symbol) return jsonError('Invalid symbol');

  const { searchParams } = new URL(request.url);
  const limitRaw = searchParams.get('limit') || '50';
  const limit = Math.max(10, Math.min(200, Number(limitRaw) || 50));

  let data: any;
  try {
    data = await fetchBinanceJson(`/api/v3/trades?symbol=${symbol}&limit=${limit}`, {
      cache: 'no-store',
    });
  } catch {
    return jsonError('Market data unavailable', 502);
  }
  return NextResponse.json(
    {
      symbol,
      trades: data.map((t: any) => ({
        id: t.id,
        price: t.price,
        qty: t.qty,
        quoteQty: t.quoteQty,
        time: t.time,
        isBuyerMaker: t.isBuyerMaker,
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
