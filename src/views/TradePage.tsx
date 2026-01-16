'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';

type Ticker24h = {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
};

type Depth = {
  bids: [string, string][];
  asks: [string, string][];
};

type Trade = {
  id: number;
  price: string;
  qty: string;
  time: number;
  isBuyerMaker: boolean;
};

type Candle = { openTime: number; close: string };
type Order = {
  id: string;
  pair: string;
  side: 'buy' | 'sell';
  order_type: 'market' | 'limit';
  price: string | number | null;
  amount: string | number;
  status: string;
  created_at: string;
};
type PerpOrder = {
  id: string;
  pair: string;
  side: 'long' | 'short';
  order_type: 'market' | 'limit';
  price: string | number | null;
  amount: string | number;
  leverage: string | number;
  margin: string | number;
  status: string;
  created_at: string;
};
type PerpPosition = {
  id: string;
  pair: string;
  side: 'long' | 'short';
  size: string | number;
  entry_price: string | number;
  leverage: string | number;
  margin: string | number;
  liquidation_price: string | number | null;
  take_profit?: string | number | null;
  stop_loss?: string | number | null;
  status: string;
  created_at: string;
};

const PAIRS = [
  { label: 'BTC/USDT', symbol: 'BTCUSDT', base: 'BTC', quote: 'USDT' },
  { label: 'ETH/USDT', symbol: 'ETHUSDT', base: 'ETH', quote: 'USDT' },
  { label: 'SOL/USDT', symbol: 'SOLUSDT', base: 'SOL', quote: 'USDT' },
  { label: 'XRP/USDT', symbol: 'XRPUSDT', base: 'XRP', quote: 'USDT' },
] as const;

const USE_SIMULATED_ORDERBOOK = true;

function formatNumber(input: string | number, maximumFractionDigits = 2) {
  const value = typeof input === 'number' ? input : Number(input);
  if (!Number.isFinite(value)) return '-';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(value);
}

function formatMoney(input: string | number, maximumFractionDigits = 2) {
  const value = typeof input === 'number' ? input : Number(input);
  if (!Number.isFinite(value)) return '-';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits,
  }).format(value);
}

function formatTime(ms: number) {
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function buildSimulatedDepth(
  midPrice: number,
  levels: number,
  base: string,
  prev?: Depth | null,
): Depth {
  const step = Math.max(0.01, midPrice * 0.0004);
  const spread = Math.max(0.02, midPrice * 0.0003);

  const asks: [string, string][] = [];
  const bids: [string, string][] = [];
  const baseUpper = base.toUpperCase();
  const range =
    baseUpper === 'BTC' || baseUpper === 'ETH'
      ? { min: 0.1, max: Number((4.5 + Math.random() * 0.6).toFixed(7)) }
      : baseUpper === 'SOL'
        ? { min: Number((1 + Math.random() * 2).toFixed(7)), max: Number((47 + Math.random() * 3).toFixed(7)) }
        : baseUpper === 'XRP'
          ? { min: Number((80 + Math.random() * 40).toFixed(8)), max: Number((4500 + Math.random() * 400).toFixed(8)) }
          : { min: 0.1, max: 10 };
  const clamp = (value: number) => Math.min(range.max, Math.max(range.min, value));

  for (let i = 0; i < levels; i += 1) {
    const askPrice = midPrice + spread + step * i;
    const bidPrice = midPrice - spread - step * i;
    const prevAskQty = prev?.asks?.[i]?.[1];
    const prevBidQty = prev?.bids?.[i]?.[1];

    const askQty = prevAskQty
      ? clamp(Number(prevAskQty) * (0.75 + Math.random() * 0.6))
      : range.min + Math.random() * (range.max - range.min);
    const bidQty = prevBidQty
      ? clamp(Number(prevBidQty) * (0.75 + Math.random() * 0.6))
      : range.min + Math.random() * (range.max - range.min);

    asks.push([askPrice.toFixed(2), askQty.toFixed(6)]);
    bids.push([bidPrice.toFixed(2), bidQty.toFixed(6)]);
  }

  return { asks, bids };
}

function Sparkline({ points }: { points: number[] }) {
  const width = 600;
  const height = 220;
  const padding = 8;

  const { path, stroke } = useMemo(() => {
    if (points.length < 2) return { path: '', stroke: '#22c55e' };
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = max - min || 1;
    const toX = (i: number) => padding + (i / (points.length - 1)) * (width - padding * 2);
    const toY = (v: number) => height - padding - ((v - min) / span) * (height - padding * 2);

    const d = points
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(2)} ${toY(v).toFixed(2)}`)
      .join(' ');
    const strokeColor = points[points.length - 1] >= points[0] ? '#22c55e' : '#ef4444';
    return { path: d, stroke: strokeColor };
  }, [points]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-80 w-full rounded-2xl bg-gradient-to-b from-gray-50 to-white border border-gray-100"
      role="img"
      aria-label="Price chart"
      preserveAspectRatio="none"
    >
      <path d={path} fill="none" stroke={stroke} strokeWidth="2.5" />
    </svg>
  );
}

function TradingViewWidget({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      if (!containerRef.current || !(window as any).TradingView) return;
      new (window as any).TradingView.widget({
        autosize: true,
        symbol,
        interval: '15',
        timezone: 'Etc/UTC',
        theme: 'light',
        style: '1',
        locale: 'en',
        hide_top_toolbar: false,
        hide_legend: false,
        allow_symbol_change: false,
        container_id: containerRef.current.id,
      });
    };
    containerRef.current.appendChild(script);
  }, [symbol]);

  return (
    <div
      id={`tv-${symbol.toLowerCase()}`}
      ref={containerRef}
      className="h-[420px] w-full"
    />
  );
}

export default function TradePage() {
  const { user, authenticated } = usePrivy();
  const [pairSymbol, setPairSymbol] = useState<(typeof PAIRS)[number]['symbol']>('BTCUSDT');
  const pair = PAIRS.find((p) => p.symbol === pairSymbol) ?? PAIRS[0];

  const [ticker, setTicker] = useState<Ticker24h | null>(null);
  const [depth, setDepth] = useState<Depth | null>(null);
  const [simDepth, setSimDepth] = useState<Depth | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [wsConnected, setWsConnected] = useState(false);

  const [activeSide, setActiveSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [tradeMode, setTradeMode] = useState<'spot' | 'perp'>('spot');
  const [perpSide, setPerpSide] = useState<'long' | 'short'>('long');
  const [perpOrderType, setPerpOrderType] = useState<'market' | 'limit'>('market');
  const [perpPrice, setPerpPrice] = useState('');
  const [perpAmount, setPerpAmount] = useState('');
  const [perpLeverage, setPerpLeverage] = useState(25);
  const [perpTpSlEnabled, setPerpTpSlEnabled] = useState(false);
  const [perpTakeProfit, setPerpTakeProfit] = useState('');
  const [perpStopLoss, setPerpStopLoss] = useState('');
  const [perpError, setPerpError] = useState<string | null>(null);
  const [perpSuccess, setPerpSuccess] = useState<string | null>(null);
  const [orderbookView, setOrderbookView] = useState<'all' | 'buy' | 'sell'>('all');
  const simTickRef = useRef(0);
  const simDepthRef = useRef<Depth | null>(null);
  const simInitializedRef = useRef(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [perpOrders, setPerpOrders] = useState<PerpOrder[]>([]);
  const [perpPositions, setPerpPositions] = useState<PerpPosition[]>([]);
  const [perpOrdersError, setPerpOrdersError] = useState<string | null>(null);
  const [perpPositionsError, setPerpPositionsError] = useState<string | null>(null);
  const [historyRecords, setHistoryRecords] = useState<Array<Record<string, any>>>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'holding' | 'positions' | 'records'>('holding');
  const perpAutoCloseRef = useRef(new Set<string>());

  useEffect(() => {
    simInitializedRef.current = false;
    simTickRef.current = 0;
    simDepthRef.current = null;
    setSimDepth(null);
  }, [pairSymbol]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setSuccess(null);

    async function loadInitial() {
      try {
        const [tickerRes, depthRes, tradesRes, klinesRes] = await Promise.all([
          fetch(`/api/market/ticker?symbol=${pairSymbol}`, { cache: 'no-store' }),
          fetch(`/api/market/depth?symbol=${pairSymbol}&limit=20`, { cache: 'no-store' }),
          fetch(`/api/market/trades?symbol=${pairSymbol}&limit=50`, { cache: 'no-store' }),
          fetch(`/api/market/klines?symbol=${pairSymbol}&interval=1m&limit=200`, { cache: 'no-store' }),
        ]);

        if (!tickerRes.ok || !depthRes.ok || !tradesRes.ok || !klinesRes.ok) {
          throw new Error('Failed to load market data');
        }

        const [tickerJson, depthJson, tradesJson, klinesJson] = await Promise.all([
          tickerRes.json(),
          depthRes.json(),
          tradesRes.json(),
          klinesRes.json(),
        ]);

        if (cancelled) return;
        setTicker(tickerJson);
        setDepth({ bids: depthJson.bids, asks: depthJson.asks });
        setTrades(tradesJson.trades);
        setCandles(klinesJson.candles);
        setPrice(orderType === 'limit' ? tickerJson.lastPrice : '');
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load market data');
      }
    }

    loadInitial();
    return () => {
      cancelled = true;
    };
  }, [pairSymbol]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let cancelled = false;
    const streamSymbol = pairSymbol.toLowerCase();

    try {
      ws = new WebSocket(
        `wss://stream.binance.com:9443/stream?streams=${streamSymbol}@ticker/${streamSymbol}@trade/${streamSymbol}@depth20@100ms`,
      );
    } catch {
      setWsConnected(false);
      return undefined;
    }

    ws.onopen = () => {
      if (!cancelled) setWsConnected(true);
    };
    ws.onclose = () => {
      if (!cancelled) setWsConnected(false);
    };
    ws.onerror = () => {
      if (!cancelled) setWsConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const { stream, data } = payload ?? {};
        if (!stream || !data) return;

        if (stream.endsWith('@ticker')) {
          setTicker({
            symbol: data.s,
            lastPrice: data.c,
            priceChangePercent: data.P,
            highPrice: data.h,
            lowPrice: data.l,
            volume: data.v,
            quoteVolume: data.q,
          });
        } else if (stream.includes('@trade')) {
          const trade: Trade = {
            id: data.t,
            price: data.p,
            qty: data.q,
            time: data.T,
            isBuyerMaker: data.m,
          };
          setTrades((prev) => [trade, ...prev].slice(0, 50));
        } else if (stream.includes('@depth')) {
          setDepth({ bids: data.b, asks: data.a });
        }
      } catch {
        // ignore parse errors
      }
    };

    return () => {
      cancelled = true;
      ws?.close();
    };
  }, [pairSymbol]);

  useEffect(() => {
    let timer: any;
    let cancelled = false;

    async function poll() {
      if (wsConnected) {
        timer = setTimeout(poll, 15000);
        return;
      }
      try {
        const [tickerRes, depthRes, tradesRes] = await Promise.all([
          fetch(`/api/market/ticker?symbol=${pairSymbol}`, { cache: 'no-store' }),
          fetch(`/api/market/depth?symbol=${pairSymbol}&limit=20`, { cache: 'no-store' }),
          fetch(`/api/market/trades?symbol=${pairSymbol}&limit=50`, { cache: 'no-store' }),
        ]);
        if (!tickerRes.ok || !depthRes.ok || !tradesRes.ok) return;

        const [tickerJson, depthJson, tradesJson] = await Promise.all([
          tickerRes.json(),
          depthRes.json(),
          tradesRes.json(),
        ]);
        if (cancelled) return;

        setTicker(tickerJson);
        setDepth({ bids: depthJson.bids, asks: depthJson.asks });
        setTrades(tradesJson.trades);
      } catch {
        // ignore transient polling errors
      } finally {
        if (!cancelled) timer = setTimeout(poll, 15000);
      }
    }

    timer = setTimeout(poll, 15000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pairSymbol, wsConnected]);

  useEffect(() => {
    if (orderType === 'limit' && ticker?.lastPrice) setPrice(ticker.lastPrice);
    if (orderType === 'market') setPrice('');
  }, [orderType, ticker?.lastPrice]);

  useEffect(() => {
    if (!USE_SIMULATED_ORDERBOOK) return undefined;
    let timer: any;
    let cancelled = false;
    if (!simInitializedRef.current) {
      simTickRef.current = 0;
      simDepthRef.current = null;
      setSimDepth(null);
    }

    const tick = () => {
      if (cancelled) return;
      const mid = Number(ticker?.lastPrice ?? 0);
      if (Number.isFinite(mid) && mid > 0) {
        const nextDepth = buildSimulatedDepth(mid, 12, pair.base, simDepthRef.current);
        simTickRef.current += 1;
        simDepthRef.current = nextDepth;
        if (!simInitializedRef.current && simTickRef.current < 3) {
          timer = setTimeout(tick, 1500);
          return;
        }
        simInitializedRef.current = true;
        if (simTickRef.current >= 3) {
          setSimDepth(nextDepth);
        }
      }
      timer = setTimeout(tick, 1500);
    };

    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ticker?.lastPrice]);

  useEffect(() => {
    if (perpOrderType === 'limit' && ticker?.lastPrice) setPerpPrice(ticker.lastPrice);
    if (perpOrderType === 'market') setPerpPrice('');
  }, [perpOrderType, ticker?.lastPrice]);

  const chartPoints = useMemo(() => {
    const points = candles.map((c) => Number(c.close)).filter((n) => Number.isFinite(n));
    return points.slice(-200);
  }, [candles]);

  const priceChange = Number(ticker?.priceChangePercent ?? 0);
  const changeIsUp = Number.isFinite(priceChange) ? priceChange >= 0 : true;
  const currentPrice = Number(ticker?.lastPrice ?? 0);

  const baseBalance = balances[pair.base] ?? 0;
  const quoteBalance = balances[pair.quote] ?? 0;

  const parsedAmount = Number(amount);
  const parsedPrice = orderType === 'limit' ? Number(price) : Number(ticker?.lastPrice);
  const requiredQuote = Number.isFinite(parsedAmount) && Number.isFinite(parsedPrice)
    ? parsedAmount * parsedPrice
    : 0;
  const hasSufficientBalance =
    activeSide === 'buy'
      ? Number.isFinite(requiredQuote) && requiredQuote <= quoteBalance
      : Number.isFinite(parsedAmount) && parsedAmount <= baseBalance;

  async function submitOrder() {
    setError(null);
    setSuccess(null);
    const amt = Number(amount);
    const pr = orderType === 'limit' ? Number(price) : Number(ticker?.lastPrice);
    const userId = (user as any)?.id;

    if (!Number.isFinite(amt) || amt <= 0) return setError('Enter a valid amount');
    if (!Number.isFinite(pr) || pr <= 0) return setError('Price unavailable');
    if (
      (activeSide === 'buy' && requiredQuote > quoteBalance) ||
      (activeSide === 'sell' && amt > baseBalance)
    ) {
      return setError('Insufficient balance');
    }

    setLoading(true);
    try {
      if (!userId) throw new Error('Please log in');
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: String(userId),
          pair: pair.symbol,
          base: pair.base,
          quote: pair.quote,
          side: activeSide,
          order_type: orderType,
          price: pr,
          amount: amt,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? 'Failed to place order');
      }
      setSuccess(`${activeSide === 'buy' ? 'Buy' : 'Sell'} order placed`);
      setAmount('');
    } catch (e: any) {
      setError(e?.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  }

  async function submitPerpOrder() {
    setPerpError(null);
    setPerpSuccess(null);

    const amt = Number(perpAmount);
    const pr = perpOrderType === 'limit' ? Number(perpPrice) : Number(ticker?.lastPrice);
    const userId = (user as any)?.id;
    if (!Number.isFinite(amt) || amt <= 0) return setPerpError('Enter a valid amount');
    if (!Number.isFinite(pr) || pr <= 0) return setPerpError('Price unavailable');

    setLoading(true);
    try {
      if (!userId) throw new Error('Please log in');
      const res = await fetch('/api/perp/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: String(userId),
          pair: pair.symbol,
          side: perpSide,
          order_type: perpOrderType,
          price: pr,
          amount: amt,
          leverage: perpLeverage,
          take_profit: perpTpSlEnabled && perpTakeProfit ? Number(perpTakeProfit) : null,
          stop_loss: perpTpSlEnabled && perpStopLoss ? Number(perpStopLoss) : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? 'Failed to place perp order');
      }
      setPerpSuccess('Perp order placed');
      setPerpAmount('');
    } catch (e: any) {
      setPerpError(e?.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  }

  async function cancelOrder(orderId: string) {
    const userId = (user as any)?.id;
    if (!userId) return;
    try {
      const res = await fetch('/api/orders/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: String(userId), order_id: orderId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? 'Failed to cancel order');
      }
      setOrders((prev) =>
        prev.map((order) => (order.id === orderId ? { ...order, status: 'canceled' } : order)),
      );
    } catch (err) {
      // ignore
    }
  }

  async function closePerpPosition(positionId: string) {
    const userId = (user as any)?.id;
    if (!userId) return;
    try {
      const res = await fetch('/api/perp/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: String(userId),
          position_id: positionId,
          exit_price: Number(ticker?.lastPrice ?? 0),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? 'Failed to close position');
      }
      setPerpPositions((prev) =>
        prev.map((pos) => (pos.id === positionId ? { ...pos, status: 'closed' } : pos)),
      );
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!currentPrice || perpPositions.length === 0) return;
    const openPositions = perpPositions.filter((pos) => pos.status === 'open');
    if (!openPositions.length) return;

    openPositions.forEach((pos) => {
      if (perpAutoCloseRef.current.has(pos.id)) return;
      const tp = Number(pos.take_profit ?? 0);
      const sl = Number(pos.stop_loss ?? 0);
      const hasTp = Number.isFinite(tp) && tp > 0;
      const hasSl = Number.isFinite(sl) && sl > 0;
      if (!hasTp && !hasSl) return;

      const hitTp = pos.side === 'long' ? currentPrice >= tp : currentPrice <= tp;
      const hitSl = pos.side === 'long' ? currentPrice <= sl : currentPrice >= sl;
      if ((hasTp && hitTp) || (hasSl && hitSl)) {
        perpAutoCloseRef.current.add(pos.id);
        void closePerpPosition(pos.id);
      }
    });
  }, [currentPrice, perpPositions]);

  const activeDepth = USE_SIMULATED_ORDERBOOK ? simDepth : depth;
  const orderbookLimit = orderbookView === 'all' ? 6 : 12;
  const orderbookAsks = (activeDepth?.asks ?? []).slice(0, orderbookLimit);
  const orderbookBids = (activeDepth?.bids ?? []).slice(0, orderbookLimit);

  useEffect(() => {
    const userId = (user as any)?.id;
    if (!authenticated || !userId) {
      setBalances({});
      return;
    }
    const safeUserId = String(userId);

    let cancelled = false;
    async function loadBalances() {
      try {
        const res = await fetch(
          `/api/balances?user_id=${encodeURIComponent(safeUserId)}&account_type=spot`,
          { cache: 'no-store' },
        );
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const map: Record<string, number> = {};
        for (const row of data?.balances ?? []) {
          const asset = String(row.asset);
          map[asset] = Number(row.available ?? 0);
        }
        setBalances(map);
      } catch {
        // ignore
      }
    }

    loadBalances();
    const timer = setInterval(loadBalances, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [authenticated, user]);

  useEffect(() => {
    const userId = (user as any)?.id;
    if (!authenticated || !userId) {
      setOrders([]);
      return;
    }

    let cancelled = false;
    async function loadOrders() {
      try {
        const res = await fetch(`/api/orders?user_id=${encodeURIComponent(String(userId))}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load orders');
        const data = await res.json();
        if (cancelled) return;
        setOrders(data?.orders ?? []);
        setOrdersError(null);
      } catch (err: any) {
        if (!cancelled) setOrdersError(err?.message ?? 'Failed to load orders');
      }
    }

    loadOrders();
    const timer = setInterval(loadOrders, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [authenticated, user]);

  useEffect(() => {
    const userId = (user as any)?.id;
    if (!authenticated || !userId) {
      setPerpOrders([]);
      setPerpPositions([]);
      return;
    }

    let cancelled = false;
    async function loadPerp() {
      try {
        const [ordersRes, positionsRes] = await Promise.all([
          fetch(`/api/perp/orders?user_id=${encodeURIComponent(String(userId))}`, { cache: 'no-store' }),
          fetch(`/api/perp/positions?user_id=${encodeURIComponent(String(userId))}`, { cache: 'no-store' }),
        ]);
        if (!ordersRes.ok || !positionsRes.ok) throw new Error('Failed to load perp data');
        const [ordersJson, positionsJson] = await Promise.all([ordersRes.json(), positionsRes.json()]);
        if (cancelled) return;
        setPerpOrders(ordersJson?.orders ?? []);
        setPerpPositions(positionsJson?.positions ?? []);
        setPerpOrdersError(null);
        setPerpPositionsError(null);
      } catch (err: any) {
        if (!cancelled) {
          setPerpOrdersError(err?.message ?? 'Failed to load perp orders');
          setPerpPositionsError(err?.message ?? 'Failed to load positions');
        }
      }
    }

    loadPerp();
    const timer = setInterval(loadPerp, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [authenticated, user]);

  useEffect(() => {
    const userId = (user as any)?.id;
    if (!authenticated || !userId) {
      setHistoryRecords([]);
      return;
    }

    let cancelled = false;
    async function loadHistory() {
      try {
        const res = await fetch(`/api/history?user_id=${encodeURIComponent(String(userId))}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load history');
        const data = await res.json();
        if (cancelled) return;
        setHistoryRecords(data?.records ?? []);
        setHistoryError(null);
      } catch (err: any) {
        if (!cancelled) setHistoryError(err?.message ?? 'Failed to load history');
      }
    }

    loadHistory();
    const timer = setInterval(loadHistory, 20000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [authenticated, user]);
  const orderbookMaxQty = useMemo(() => {
    const quantities = [...orderbookAsks, ...orderbookBids].map((row) => Number(row[1]));
    const max = Math.max(...quantities, 0);
    return max > 0 ? max : 1;
  }, [orderbookAsks, orderbookBids]);

  return (
    <div className="min-h-screen bg-white">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <select
                value={pairSymbol}
                onChange={(e) => setPairSymbol(e.target.value as any)}
                className="appearance-none pr-10 pl-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                {PAIRS.map((p) => (
                  <option key={p.symbol} value={p.symbol}>
                    {p.label}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">▼</span>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900">{ticker ? formatMoney(ticker.lastPrice) : '—'}</div>
              <div className={`text-xs font-semibold ${changeIsUp ? 'text-emerald-600' : 'text-rose-500'}`}>
                {ticker ? `${changeIsUp ? '+' : ''}${formatNumber(ticker.priceChangePercent, 2)}%` : '—'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6 text-xs text-gray-500">
            <div>
              <div>24h Change</div>
              <div className={`font-semibold ${changeIsUp ? 'text-emerald-600' : 'text-rose-500'}`}>
                {ticker ? `${changeIsUp ? '+' : ''}${formatNumber(ticker.priceChangePercent, 2)}%` : '—'}
              </div>
            </div>
            <div>
              <div>24h High</div>
              <div className="font-semibold text-gray-900">{ticker ? formatMoney(ticker.highPrice) : '—'}</div>
            </div>
            <div>
              <div>24h Low</div>
              <div className="font-semibold text-gray-900">{ticker ? formatMoney(ticker.lowPrice) : '—'}</div>
            </div>
            <div>
              <div>24h Vol ({pair.base})</div>
              <div className="font-semibold text-gray-900">{ticker ? formatNumber(ticker.volume, 2) : '—'}</div>
            </div>
            <div>
              <div>24h Vol ({pair.quote})</div>
              <div className="font-semibold text-gray-900">{ticker ? formatNumber(ticker.quoteVolume, 2) : '—'}</div>
            </div>
            <div className="hidden lg:block">
              <div>Assets</div>
              <Link href="/deposit" className="font-semibold text-gray-900 hover:underline">
                Deposit
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[40px_1.55fr_320px_320px]">
          <div className="hidden lg:flex flex-col items-center gap-4 text-gray-400">
            {['⇵', '⌁', '✎', '▦', '◌', '⌖', '⌁', '⇄', '◎', '⌂'].map((icon, idx) => (
              <span key={idx} className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-100">
                {icon}
              </span>
            ))}
          </div>

          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">{pair.label}</div>
            <div className="p-4">
              {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
              ) : (
                <TradingViewWidget symbol={`BINANCE:${pairSymbol}`} />
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">Limit</div>
            <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-gray-400">
                <span className="h-3.5 w-3.5 border border-gray-300 rounded-sm bg-gray-100" />
                <span className="h-3.5 w-3.5 border border-gray-300 rounded-sm bg-emerald-100" />
                <span className="h-3.5 w-3.5 border border-gray-300 rounded-sm bg-rose-100" />
              </div>
              <div className="flex rounded-full border border-gray-200 overflow-hidden">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'buy', label: 'Buys' },
                  { key: 'sell', label: 'Sells' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setOrderbookView(tab.key as 'all' | 'buy' | 'sell')}
                    className={`px-3 py-1 text-[10px] font-semibold transition ${
                      orderbookView === tab.key ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-4 py-2 text-xs text-gray-500 grid grid-cols-2">
              <span>Price($)</span>
              <span className="text-right">Amount</span>
            </div>
            <div className="px-4 pb-3">
              <div className="max-h-[420px] overflow-hidden">
                {(orderbookView === 'all' || orderbookView === 'sell') ? (
                  <div className="space-y-1 text-[10px] font-mono">
                    {orderbookAsks.map((ask, idx) => {
                      const p = Number(ask[0]);
                      const q = Number(ask[1]);
                      const pct = Math.min(100, (q / orderbookMaxQty) * 100);
                      return (
                        <div key={`${ask[0]}-${idx}`} className="relative grid grid-cols-2 items-center py-1">
                          <span
                            className="absolute inset-y-0 right-0 bg-rose-100/70"
                            style={{ width: `${pct}%` }}
                            aria-hidden="true"
                          />
                          <span className="relative z-10 text-rose-500">{formatNumber(p, 2)}</span>
                          <span className="relative z-10 text-right text-gray-700">{formatNumber(q, 8)}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {(orderbookView === 'all') ? (
                  <div className="py-3 border-y border-gray-100 text-sm font-semibold text-gray-900">
                    {ticker ? formatMoney(ticker.lastPrice) : '—'}
                  </div>
                ) : null}
                {(orderbookView === 'all' || orderbookView === 'buy') ? (
                  <div className="space-y-1 text-[10px] font-mono">
                    {orderbookBids.map((bid, idx) => {
                      const p = Number(bid[0]);
                      const q = Number(bid[1]);
                      const pct = Math.min(100, (q / orderbookMaxQty) * 100);
                      return (
                        <div key={`${bid[0]}-${idx}`} className="relative grid grid-cols-2 items-center py-1">
                          <span
                            className="absolute inset-y-0 right-0 bg-emerald-100/70"
                            style={{ width: `${pct}%` }}
                            aria-hidden="true"
                          />
                          <span className="relative z-10 text-emerald-600">{formatNumber(p, 2)}</span>
                          <span className="relative z-10 text-right text-gray-700">{formatNumber(q, 8)}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between text-sm font-semibold text-gray-900">
              <div className="flex rounded-full border border-gray-200 overflow-hidden text-xs">
                <button
                  onClick={() => setTradeMode('spot')}
                  className={`px-4 py-2 font-semibold transition ${
                    tradeMode === 'spot' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Spot
                </button>
                <button
                  onClick={() => setTradeMode('perp')}
                  className={`px-4 py-2 font-semibold transition ${
                    tradeMode === 'perp' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Perpetual
                </button>
              </div>
            </div>

            {tradeMode === 'spot' ? (
              <>
                <div className="flex rounded-full border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => setActiveSide('buy')}
                    className={`flex-1 py-2 text-sm font-semibold transition ${
                      activeSide === 'buy' ? 'bg-emerald-600 text-white' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => setActiveSide('sell')}
                    className={`flex-1 py-2 text-sm font-semibold transition ${
                      activeSide === 'sell' ? 'bg-rose-500 text-white' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Sell
                  </button>
                </div>

                <div className="flex gap-3 text-sm">
                  <button
                    onClick={() => setOrderType('market')}
                    className={`font-semibold ${orderType === 'market' ? 'text-gray-900' : 'text-gray-400'}`}
                  >
                    Market
                  </button>
                  <button
                    onClick={() => setOrderType('limit')}
                    className={`font-semibold ${orderType === 'limit' ? 'text-gray-900' : 'text-gray-400'}`}
                  >
                    Limit
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="relative">
                    <input
                      type="number"
                      value={orderType === 'market' ? '' : price}
                      onChange={(e) => setPrice(e.target.value)}
                      disabled={orderType === 'market'}
                      placeholder={orderType === 'market' ? 'Market' : 'Price'}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none disabled:bg-gray-50"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                      {pair.quote}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="Amount"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                      {pair.base}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[25, 50, 75, 100].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          const best = ticker?.lastPrice ? Number(ticker.lastPrice) : 0;
                          if (!Number.isFinite(best) || best <= 0) return;
                          if (activeSide === 'buy') {
                            const qty = (quoteBalance / best) * (pct / 100);
                            setAmount(qty > 0 ? qty.toFixed(8) : '');
                          } else {
                            const qty = baseBalance * (pct / 100);
                            setAmount(qty > 0 ? qty.toFixed(8) : '');
                          }
                        }}
                        className="rounded-md border border-gray-200 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                  <div className="text-xs text-gray-500">
                    Balance {formatNumber(activeSide === 'buy' ? quoteBalance : baseBalance, 2)}{' '}
                    {activeSide === 'buy' ? pair.quote : pair.base}
                  </div>
                  <button
                    onClick={submitOrder}
                    disabled={loading || !ticker || !hasSufficientBalance}
                    className={`w-full py-3 rounded-lg text-white font-semibold transition disabled:opacity-60 ${
                      activeSide === 'buy' ? 'bg-emerald-600 hover:opacity-90' : 'bg-rose-500 hover:opacity-90'
                    }`}
                  >
                    {loading ? 'Placing…' : `${activeSide === 'buy' ? 'Buy' : 'Sell'} ${pair.base}`}
                  </button>
                  {!hasSufficientBalance ? (
                    <p className="text-xs text-rose-400">Insufficient balance for this order.</p>
                  ) : null}
                  {success ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
                      {success}
                    </div>
                  ) : null}
                  {error ? (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                      {error}
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Leverage</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={perpLeverage}
                      onChange={(e) => setPerpLeverage(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                      className="w-16 rounded-md border border-gray-200 px-2 py-1 text-right text-sm"
                    />
                    <span className="text-gray-400">x</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={perpLeverage}
                  onChange={(e) => setPerpLeverage(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  {[1, 25, 50, 75, 100].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPerpLeverage(value)}
                      className={`rounded-full border px-2 py-1 ${
                        perpLeverage === value ? 'border-gray-900 text-gray-900' : 'border-gray-200'
                      }`}
                    >
                      {value}x
                    </button>
                  ))}
                </div>

                <div className="flex gap-3 text-sm">
                  <button
                    onClick={() => setPerpOrderType('market')}
                    className={`font-semibold ${perpOrderType === 'market' ? 'text-gray-900' : 'text-gray-400'}`}
                  >
                    Market
                  </button>
                  <button
                    onClick={() => setPerpOrderType('limit')}
                    className={`font-semibold ${perpOrderType === 'limit' ? 'text-gray-900' : 'text-gray-400'}`}
                  >
                    Limit
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="relative">
                    <input
                      type="number"
                      value={perpOrderType === 'market' ? '' : perpPrice}
                      onChange={(e) => setPerpPrice(e.target.value)}
                      disabled={perpOrderType === 'market'}
                      placeholder={perpOrderType === 'market' ? 'Market' : 'Price'}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none disabled:bg-gray-50"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                      {pair.quote}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="Amount"
                      value={perpAmount}
                      onChange={(e) => setPerpAmount(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">USDT</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Minimum 1</span>
                    <span>Maximum 100000</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[25, 50, 75, 100].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          const best = ticker?.lastPrice ? Number(ticker.lastPrice) : 0;
                          if (!Number.isFinite(best) || best <= 0) return;
                          const maxQty = (quoteBalance * perpLeverage) / best;
                          const qty = maxQty * (pct / 100);
                          setPerpAmount(qty > 0 ? qty.toFixed(6) : '');
                        }}
                        className="rounded-md border border-gray-200 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-xs">
                    <span className="text-gray-500">TP/SL</span>
                    <button
                      type="button"
                      onClick={() => setPerpTpSlEnabled((prev) => !prev)}
                      className={`h-5 w-10 rounded-full border transition ${
                        perpTpSlEnabled ? 'bg-gray-900 border-gray-900' : 'bg-gray-200 border-gray-200'
                      }`}
                    >
                      <span
                        className={`block h-4 w-4 rounded-full bg-white transition ${
                          perpTpSlEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  {perpTpSlEnabled ? (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        placeholder="Take profit"
                        value={perpTakeProfit}
                        onChange={(e) => setPerpTakeProfit(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                      />
                      <input
                        type="number"
                        placeholder="Stop loss"
                        value={perpStopLoss}
                        onChange={(e) => setPerpStopLoss(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                      />
                    </div>
                  ) : null}
                  <div className="text-xs text-gray-500">
                    Available {formatNumber(quoteBalance, 2)} {pair.quote}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        setPerpSide('long');
                        submitPerpOrder();
                      }}
                      disabled={loading || !ticker}
                      className="w-full py-3 rounded-lg text-white font-semibold transition disabled:opacity-60 bg-emerald-600 hover:opacity-90"
                    >
                      {loading ? 'Placing…' : 'Buy Long'}
                    </button>
                    <button
                      onClick={() => {
                        setPerpSide('short');
                        submitPerpOrder();
                      }}
                      disabled={loading || !ticker}
                      className="w-full py-3 rounded-lg text-white font-semibold transition disabled:opacity-60 bg-rose-500 hover:opacity-90"
                    >
                      {loading ? 'Placing…' : 'Sell Short'}
                    </button>
                  </div>
                  {perpSuccess ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
                      {perpSuccess}
                    </div>
                  ) : null}
                  {perpError ? (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                      {perpError}
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              {[
                { key: 'holding', label: 'My Holding' },
                { key: 'positions', label: 'Current Position' },
                { key: 'records', label: 'Transaction Records' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`pb-1 font-semibold ${
                    activeTab === tab.key ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-500">
              <input type="checkbox" className="h-3.5 w-3.5 rounded border-gray-300" />
              Hide other order
            </label>
          </div>
          <div className="overflow-x-auto">
            {activeTab === 'holding' ? (
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    {['Asset', 'Available', 'Locked'].map((header) => (
                      <th key={header} className="whitespace-nowrap px-3 py-2 text-left font-semibold">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(balances).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-10 text-center text-xs text-gray-400">
                        No balances
                      </td>
                    </tr>
                  ) : (
                    Object.entries(balances).map(([asset, available]) => (
                      <tr key={asset} className="border-t border-gray-100 text-gray-600">
                        <td className="px-3 py-2 whitespace-nowrap">{asset}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatNumber(available, 6)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">0</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : null}

            {activeTab === 'positions' ? (
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    {[
                      'Pair',
                      'Side',
                      'Size',
                      'Entry',
                      'Current',
                      'PNL',
                      'ROE',
                      'Liq.',
                      'Margin',
                      'Status',
                      'Action',
                    ].map((header) => (
                      <th key={header} className="whitespace-nowrap px-3 py-2 text-left font-semibold">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {perpPositions.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-3 py-10 text-center text-xs text-gray-400">
                        {perpPositionsError ?? 'No positions'}
                      </td>
                    </tr>
                  ) : (
                    perpPositions.map((pos) => {
                      const entry = Number(pos.entry_price ?? 0);
                      const size = Number(pos.size ?? 0);
                      const margin = Number(pos.margin ?? 0);
                      const pnl =
                        pos.side === 'long'
                          ? (currentPrice - entry) * size
                          : (entry - currentPrice) * size;
                      const roe = margin > 0 ? (pnl / margin) * 100 : 0;

                      return (
                        <tr key={pos.id} className="border-t border-gray-100 text-gray-600">
                          <td className="px-3 py-2 whitespace-nowrap">{pos.pair}</td>
                          <td
                            className={`px-3 py-2 whitespace-nowrap font-semibold ${
                              pos.side === 'long' ? 'text-emerald-600' : 'text-rose-500'
                            }`}
                          >
                            {pos.side.toUpperCase()}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">{formatNumber(pos.size, 6)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{formatMoney(entry)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {currentPrice ? formatMoney(currentPrice) : '—'}
                          </td>
                          <td
                            className={`px-3 py-2 whitespace-nowrap ${
                              pnl >= 0 ? 'text-emerald-600' : 'text-rose-500'
                            }`}
                          >
                            {formatNumber(pnl, 2)}
                          </td>
                          <td
                            className={`px-3 py-2 whitespace-nowrap ${
                              roe >= 0 ? 'text-emerald-600' : 'text-rose-500'
                            }`}
                          >
                            {formatNumber(roe, 2)}%
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {pos.liquidation_price ? formatMoney(pos.liquidation_price) : '—'}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">{formatNumber(pos.margin, 4)}</td>
                          <td className="px-3 py-2 whitespace-nowrap capitalize">{pos.status}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {pos.status === 'open' ? (
                              <button
                                onClick={() => closePerpPosition(pos.id)}
                                className="rounded-md border border-gray-200 px-2 py-1 text-[10px] font-semibold text-gray-700 hover:bg-gray-50"
                              >
                                Close
                              </button>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            ) : null}

            {activeTab === 'records' ? (
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    {['Date', 'Type', 'Asset', 'Amount', 'Fee', 'Status'].map((header) => (
                      <th key={header} className="whitespace-nowrap px-3 py-2 text-left font-semibold">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historyRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-10 text-center text-xs text-gray-400">
                        {historyError ?? 'No records'}
                      </td>
                    </tr>
                  ) : (
                    historyRecords.map((row) => (
                      <tr key={row.id} className="border-t border-gray-100 text-gray-600">
                        <td className="px-3 py-2 whitespace-nowrap">{formatTime(new Date(row.created_at).getTime())}</td>
                        <td className="px-3 py-2 whitespace-nowrap capitalize">{row.type}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{row.asset}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatNumber(row.amount, 6)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatNumber(row.fee ?? 0, 6)}</td>
                        <td className="px-3 py-2 whitespace-nowrap capitalize">{row.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : null}
          </div>
        </div>

      </div>
    </div>
  );
}
