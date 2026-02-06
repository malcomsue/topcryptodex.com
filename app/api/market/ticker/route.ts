import { NextResponse } from 'next/server';
import { fetchBinanceJson, getSymbolFromUrl, jsonError } from '../_utils';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const symbol = getSymbolFromUrl(request.url);
  if (!symbol) return jsonError('Invalid symbol');

  let data: any;
  try {
    data = await fetchBinanceJson(`/api/v3/ticker/24hr?symbol=${symbol}`, { cache: 'no-store' });
  } catch {
    return jsonError('Market data unavailable', 502);
  }
  return NextResponse.json(
    {
      symbol: data.symbol,
      lastPrice: data.lastPrice,
      priceChangePercent: data.priceChangePercent,
      highPrice: data.highPrice,
      lowPrice: data.lowPrice,
      volume: data.volume,
      quoteVolume: data.quoteVolume,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
