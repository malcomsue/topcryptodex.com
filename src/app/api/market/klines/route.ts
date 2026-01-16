import { NextResponse } from 'next/server';
import { fetchBinanceJson, getSymbolFromUrl, jsonError } from '../_utils';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const symbol = getSymbolFromUrl(request.url);
  if (!symbol) return jsonError('Invalid symbol');

  const { searchParams } = new URL(request.url);
  const interval = (searchParams.get('interval') || '1m').toLowerCase();
  const allowedIntervals = new Set(['1m', '5m', '15m', '1h', '4h', '1d']);
  if (!allowedIntervals.has(interval)) return jsonError('Invalid interval');

  const limitRaw = searchParams.get('limit') || '200';
  const limit = Math.max(50, Math.min(500, Number(limitRaw) || 200));

  let data: any;
  try {
    data = await fetchBinanceJson(
      `/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
      { cache: 'no-store' },
    );
  } catch {
    return jsonError('Market data unavailable', 502);
  }
  return NextResponse.json(
    {
      symbol,
      interval,
      candles: data.map((c: any[]) => ({
        openTime: c[0],
        open: c[1],
        high: c[2],
        low: c[3],
        close: c[4],
        volume: c[5],
        closeTime: c[6],
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
