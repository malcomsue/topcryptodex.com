'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

type MarketRow = {
  symbol: string;
  pair: string;
  price: string;
  change: string;
  chart: number[];
};

const PAIRS = [
  {
    symbol: 'BTCUSDT',
    pair: 'BTC/USDT',
    color: '#F7931A',
    logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png?v=026',
  },
  {
    symbol: 'ETHUSDT',
    pair: 'ETH/USDT',
    color: '#627EEA',
    logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png?v=026',
  },
  {
    symbol: 'BNBUSDT',
    pair: 'BNB/USDT',
    color: '#F3BA2F',
    logo: 'https://cryptologos.cc/logos/bnb-bnb-logo.png?v=026',
  },
  {
    symbol: 'LTCUSDT',
    pair: 'LTC/USDT',
    color: '#345D9D',
    logo: 'https://cryptologos.cc/logos/litecoin-ltc-logo.png?v=026',
  },
  {
    symbol: 'DOGEUSDT',
    pair: 'DOGE/USDT',
    color: '#C2A633',
    logo: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png?v=026',
  },
  {
    symbol: 'NEOUSDT',
    pair: 'NEO/USDT',
    color: '#00C08B',
    logo: 'https://cryptologos.cc/logos/neo-neo-logo.png?v=026',
  },
  {
    symbol: 'XRPUSDT',
    pair: 'XRP/USDT',
    color: '#23292F',
    logo: 'https://cryptologos.cc/logos/xrp-xrp-logo.png?v=026',
  },
  {
    symbol: 'QTUMUSDT',
    pair: 'QTUM/USDT',
    color: '#2E9AD0',
    logo: 'https://cryptologos.cc/logos/qtum-qtum-logo.png?v=026',
  },
] as const;

function formatMoney(value: string | number) {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return '-';
  const decimals = num >= 1 ? 2 : 4;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: decimals,
  }).format(num);
}

function formatPercent(value: string | number) {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return '-';
  return `${num >= 0 ? '+' : ''}${num.toFixed(3)}%`;
}

function Sparkline({ points, negative }: { points: number[]; negative: boolean }) {
  const width = 120;
  const height = 36;
  const padding = 4;

  const { path, stroke } = useMemo(() => {
    if (points.length < 2) return { path: '', stroke: negative ? '#ef4444' : '#22c55e' };
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = max - min || 1;
    const toX = (i: number) =>
      padding + (i / (points.length - 1)) * (width - padding * 2);
    const toY = (v: number) =>
      height - padding - ((v - min) / span) * (height - padding * 2);

    const d = points
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(2)} ${toY(v).toFixed(2)}`)
      .join(' ');
    return { path: d, stroke: negative ? '#ef4444' : '#22c55e' };
  }, [points, negative]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-9 w-28" preserveAspectRatio="none">
      <path d={path} fill="none" stroke={stroke} strokeWidth="2" />
    </svg>
  );
}

export default function MarketsSection() {
  const [rows, setRows] = useState<MarketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const rowsRef = useRef<MarketRow[]>([]);
  const chartCacheRef = useRef<Record<string, number[]>>({});

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    let cancelled = false;

    async function loadCharts() {
      const chartRows: Record<string, number[]> = {};
      await Promise.all(
        PAIRS.map(async (pair) => {
          try {
            const res = await fetch(`/api/market/klines?symbol=${pair.symbol}&interval=15m&limit=30`, {
              cache: 'no-store',
            });
            if (!res.ok) return;
            const data = await res.json();
            chartRows[pair.symbol] = data.candles
              .map((c: any) => Number(c.close))
              .filter((n: number) => Number.isFinite(n));
          } catch {
            // keep existing chart on failure
          }
        }),
      );
      if (cancelled) return;
      Object.entries(chartRows).forEach(([symbol, points]) => {
        if (points && points.length > 0) {
          chartCacheRef.current[symbol] = points;
        }
      });
      setRows((prev) =>
        prev.map((row) => ({
          ...row,
          chart: chartCacheRef.current[row.symbol] ?? row.chart,
        })),
      );
    }

    async function loadTickers() {
      setLoading(true);
      const results: MarketRow[] = [];
      await Promise.all(
        PAIRS.map(async (pair) => {
          try {
            const res = await fetch(`/api/market/ticker?symbol=${pair.symbol}`, { cache: 'no-store' });
            if (!res.ok) return;
            const data = await res.json();
            results.push({
              symbol: pair.symbol,
              pair: pair.pair,
              price: formatMoney(data.lastPrice),
              change: formatPercent(data.priceChangePercent),
              chart: [],
            });
          } catch {
            // ignore individual failures
          }
        }),
      );
      if (cancelled) return;
      if (results.length === 0) {
        setRows((prev) => prev);
        setLoading(rowsRef.current.length === 0);
        return;
      }
      setRows((prev) => {
        const prevMap = new Map(prev.map((row) => [row.symbol, row]));
        return results.map((row) => ({
          ...row,
          chart: prevMap.get(row.symbol)?.chart ?? chartCacheRef.current[row.symbol] ?? [],
        }));
      });
      setLoading(false);
    }

    loadTickers();
    loadCharts();

    const timer = setInterval(loadTickers, 12000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const symbols = new Set(PAIRS.map((p) => p.symbol));
    const ws = new WebSocket('wss://stream.binance.com:9443/ws/!ticker@arr');
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (!Array.isArray(data)) return;
        const updates = data.filter((item) => symbols.has(item.symbol));
        if (!updates.length) return;

        setRows((prev) => {
          const map = new Map(prev.map((row) => [row.symbol, row]));
          updates.forEach((item) => {
            const current = map.get(item.symbol) ?? {
              symbol: item.symbol,
              pair: item.symbol,
              price: '—',
              change: '—',
              chart: [],
            };
            map.set(item.symbol, {
              ...current,
              price: formatMoney(item.lastPrice),
              change: formatPercent(item.priceChangePercent),
            });
          });
          return Array.from(map.values());
        });
        setLoading(false);
      } catch {
        // ignore parse errors
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, []);

  const rowMap = useMemo(() => {
    const map = new Map(rows.map((row) => [row.symbol, row]));
    return PAIRS.map((pair) => {
      const data = map.get(pair.symbol);
      return {
        symbol: pair.symbol,
        pair: pair.pair,
        color: pair.color,
        logo: pair.logo,
        price: data?.price ?? '—',
        change: data?.change ?? '—',
        chart: data?.chart ?? [],
      };
    });
  }, [rows]);

  return (
    <section id="markets" className="py-16 bg-white">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <h2 className="text-4xl font-bold text-gray-900 mb-4">Markets</h2>
        <p className="text-gray-600 mb-8">
          The global cryptocurrency trading market includes numerous transactions, offering both earning and spending.
        </p>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-600">
                  <th className="px-5 py-3 font-semibold">NO</th>
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-5 py-3 font-semibold">Price</th>
                  <th className="px-5 py-3 font-semibold">24h Change</th>
                  <th className="px-5 py-3 font-semibold">Chart</th>
                  <th className="px-5 py-3 font-semibold text-center"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rowMap.map((row, index) => {
                  const negative = String(row.change).startsWith('-');
                  return (
                    <tr key={row.symbol} className="hover:bg-gray-50 transition">
                      <td className="px-5 py-4 text-gray-900">{index + 1}</td>
                      <td className="px-5 py-4 font-medium text-gray-900">
                        <div className="flex items-center gap-3">
                          <div className="relative h-9 w-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden">
                            <span className="text-[10px] font-semibold text-gray-600">
                              {row.pair.split('/')[0]}
                            </span>
                            <img
                              src={row.logo}
                              alt={`${row.pair.split('/')[0]} logo`}
                              className="absolute inset-0 h-full w-full object-cover"
                              onError={(event) => {
                                event.currentTarget.style.display = 'none';
                              }}
                              loading="lazy"
                              width={36}
                              height={36}
                            />
                          </div>
                          <span>{row.pair}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-gray-900">{loading ? '—' : row.price}</td>
                      <td className="px-5 py-4">
                        <span className={`font-semibold ${negative ? 'text-rose-500' : 'text-emerald-600'}`}>
                          {loading ? '—' : row.change}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {row.chart.length > 1 ? (
                          <Sparkline points={row.chart} negative={negative} />
                        ) : (
                          <span className="text-gray-400 text-xs">Loading…</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <Link
                          href="/trade"
                          className="inline-flex items-center justify-center px-5 py-2 rounded-full bg-gray-100 text-gray-900 text-sm font-medium hover:bg-gray-200 transition"
                        >
                          Trade
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6">
          <Link href="/market" className="text-sm font-medium text-gray-900 hover:underline">
            View more
          </Link>
        </div>
      </div>
    </section>
  );
}
