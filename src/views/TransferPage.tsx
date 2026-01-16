'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { ArrowLeftRight } from 'lucide-react';

type BalanceMap = Record<string, number>;

const TOKENS = [
  { symbol: 'USDT', name: 'Tether' },
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'SOL', name: 'Solana' },
  { symbol: 'XRP', name: 'Ripple' },
];

function formatNumber(value: number, digits = 6) {
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export default function TransferPage() {
  const { user, authenticated } = usePrivy();
  const [balances, setBalances] = useState<Record<string, BalanceMap>>({
    funding: {},
    spot: {},
    perp: {},
  });
  const [selectedSymbol, setSelectedSymbol] = useState('USDT');
  const [fromAccount, setFromAccount] = useState<'funding' | 'spot' | 'perp'>('funding');
  const [toAccount, setToAccount] = useState<'funding' | 'spot' | 'perp'>('spot');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const userId = (user as any)?.id;
    if (!authenticated || !userId) {
      setBalances({ funding: {}, spot: {} });
      return;
    }

    let cancelled = false;
    async function loadBalances() {
      try {
        const [fundingRes, spotRes, perpRes] = await Promise.all([
          fetch(`/api/balances?user_id=${encodeURIComponent(String(userId))}&account_type=funding`, {
            cache: 'no-store',
          }),
          fetch(`/api/balances?user_id=${encodeURIComponent(String(userId))}&account_type=spot`, {
            cache: 'no-store',
          }),
          fetch(`/api/balances?user_id=${encodeURIComponent(String(userId))}&account_type=perp`, {
            cache: 'no-store',
          }),
        ]);
        if (!fundingRes.ok || !spotRes.ok || !perpRes.ok) return;
        const [fundingJson, spotJson, perpJson] = await Promise.all([
          fundingRes.json(),
          spotRes.json(),
          perpRes.json(),
        ]);
        if (cancelled) return;

        const funding: BalanceMap = {};
        const spot: BalanceMap = {};
        const perp: BalanceMap = {};
        for (const row of fundingJson?.balances ?? []) {
          funding[String(row.asset)] = Number(row.available ?? 0);
        }
        for (const row of spotJson?.balances ?? []) {
          spot[String(row.asset)] = Number(row.available ?? 0);
        }
        for (const row of perpJson?.balances ?? []) {
          perp[String(row.asset)] = Number(row.available ?? 0);
        }
        setBalances({ funding, spot, perp });
      } catch {
        // ignore
      }
    }

    loadBalances();
    const timer = setInterval(loadBalances, 20000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [authenticated, user]);

  const available = balances[fromAccount]?.[selectedSymbol] ?? 0;
  const parsedAmount = Number(amount);
  const isValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 && parsedAmount <= available;

  const handleSwap = () => {
    setFromAccount(toAccount);
    setToAccount(fromAccount);
  };

  const handleFromChange = (next: 'funding' | 'spot' | 'perp') => {
    setFromAccount(next);
    if (next === toAccount) {
      setToAccount(fromAccount);
    }
  };

  const handleToChange = (next: 'funding' | 'spot' | 'perp') => {
    setToAccount(next);
    if (next === fromAccount) {
      setFromAccount(toAccount);
    }
  };

  const handleTransfer = async () => {
    if (!authenticated) {
      setMessage('Log in to transfer funds.');
      return;
    }
    if (!isValidAmount) {
      setMessage('Enter a valid amount within your available balance.');
      return;
    }
    const userId = (user as any)?.id;
    if (!userId) return;

    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/balances/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: String(userId),
          asset: selectedSymbol,
          amount: parsedAmount,
          from_account: fromAccount,
          to_account: toAccount,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? 'Transfer failed');
      }
      setMessage('Transfer submitted.');
      setAmount('');
    } catch (err: any) {
      setMessage(err?.message ?? 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  const headline = useMemo(
    () => 'Transfer funds between different accounts conveniently and securely to improve fund management efficiency.',
    [],
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-black text-white py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-2">
          <div className="flex items-center justify-center gap-3 text-2xl font-semibold">
            <ArrowLeftRight size={22} />
            <span>Transfer</span>
          </div>
          <p className="text-sm text-white/70">{headline}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-700">Symbol</label>
              <select
                value={selectedSymbol}
                onChange={(e) => setSelectedSymbol(e.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              >
                {TOKENS.map((token) => (
                  <option key={token.symbol} value={token.symbol}>
                    {token.symbol} - {token.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] items-center">
              <div>
                <label className="text-sm font-semibold text-gray-700">From</label>
                <select
                  value={fromAccount}
                  onChange={(e) => handleFromChange(e.target.value as 'funding' | 'spot' | 'perp')}
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                >
                  <option value="funding">Funding Account</option>
                  <option value="spot">Spot Account</option>
                  <option value="perp">Perp Account</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleSwap}
                className="mt-6 h-10 w-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                aria-label="Swap"
              >
                <ArrowLeftRight size={16} />
              </button>

              <div>
                <label className="text-sm font-semibold text-gray-700">To</label>
                <select
                  value={toAccount}
                  onChange={(e) => handleToChange(e.target.value as 'funding' | 'spot' | 'perp')}
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                >
                  <option value="spot">Trading Account</option>
                  <option value="funding">Funding Account</option>
                  <option value="perp">Perp Account</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Size</label>
              <div className="relative mt-2">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setAmount(available ? String(available) : '')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-600"
                >
                  all
                </button>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Quantity: {formatNumber(available, 6)} {selectedSymbol}
              </div>
            </div>

            <button
              type="button"
              onClick={handleTransfer}
              disabled={loading}
              className="w-full rounded-full bg-blue-600 text-white py-3 text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-60"
            >
              {loading ? 'Submitting…' : 'Confirm'}
            </button>
            {message ? <div className="text-xs text-gray-600">{message}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
