import { NextResponse } from 'next/server';

export function getSymbolFromUrl(requestUrl: string) {
  const { searchParams } = new URL(requestUrl);
  const symbol = (searchParams.get('symbol') || '').toUpperCase();
  if (!symbol || symbol.length > 20 || !/^[A-Z0-9]+$/.test(symbol)) {
    return null;
  }
  return symbol;
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export const BINANCE_REST_BASE = process.env.BINANCE_REST_BASE || 'https://api.binance.com';
export const BINANCE_REST_FALLBACK_BASE =
  process.env.BINANCE_REST_FALLBACK_BASE || 'https://data-api.binance.vision';

type FetchResult = { ok: true; status: number; data: any } | { ok: false; status: number };

async function safeFetchJson(url: string, init?: RequestInit): Promise<FetchResult> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) return { ok: false, status: res.status };
    const data = await res.json();
    return { ok: true, status: res.status, data };
  } catch {
    return { ok: false, status: 0 };
  }
}

export async function fetchBinanceJson(path: string, init?: RequestInit) {
  const primary = await safeFetchJson(`${BINANCE_REST_BASE}${path}`, init);
  if (primary.ok) return primary.data;

  const fallback = await safeFetchJson(`${BINANCE_REST_FALLBACK_BASE}${path}`, init);
  if (fallback.ok) return fallback.data;

  throw new Error(`Binance upstream error: primary ${primary.status}, fallback ${fallback.status}`);
}
