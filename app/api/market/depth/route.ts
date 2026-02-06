import { NextResponse } from 'next/server';
import { fetchBinanceJson, getSymbolFromUrl, jsonError } from '../_utils';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const symbol = getSymbolFromUrl(request.url);
  if (!symbol) return jsonError('Invalid symbol');

  const { searchParams } = new URL(request.url);
  const limitRaw = searchParams.get('limit') || '20';
  const limit = Math.max(5, Math.min(50, Number(limitRaw) || 20));

  let data: any;
  try {
    data = await fetchBinanceJson(`/api/v3/depth?symbol=${symbol}&limit=${limit}`, {
      cache: 'no-store',
    });
  } catch {
    return jsonError('Market data unavailable', 502);
  }
  return NextResponse.json(
    {
      symbol,
      lastUpdateId: data.lastUpdateId,
      bids: data.bids,
      asks: data.asks,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
