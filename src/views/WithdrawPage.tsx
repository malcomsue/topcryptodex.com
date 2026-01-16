'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';

type TokenOption = {
  symbol: string;
  name: string;
  networks: string[];
};

const TOKENS: TokenOption[] = [
  { symbol: 'BTC', name: 'Bitcoin', networks: ['BTC', 'BTC (SegWit)', 'BTC (Legacy)'] },
  { symbol: 'ETH', name: 'Ethereum', networks: ['ERC20'] },
  { symbol: 'USDT', name: 'Tether', networks: ['ERC20', 'TRC20'] },
  { symbol: 'SOL', name: 'Solana', networks: ['SOL'] },
  { symbol: 'XRP', name: 'Ripple', networks: ['XRP'] },
];

function formatNumber(value: number, digits = 6) {
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export default function WithdrawPage() {
  const { user, authenticated } = usePrivy();
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [selectedSymbol, setSelectedSymbol] = useState('BTC');
  const [selectedNetwork, setSelectedNetwork] = useState('BTC');
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');

  const token = TOKENS.find((t) => t.symbol === selectedSymbol) ?? TOKENS[0];
  const balance = balances[selectedSymbol] ?? 0;

  useEffect(() => {
    setSelectedNetwork(token.networks[0] ?? '');
  }, [token.symbol]);

  useEffect(() => {
    const userId = (user as any)?.id;
    if (!authenticated || !userId) {
      setBalances({});
      return;
    }

    let cancelled = false;
    async function loadBalances() {
      try {
        const res = await fetch(
          `/api/balances?user_id=${encodeURIComponent(String(userId))}&account_type=funding`,
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
    const timer = setInterval(loadBalances, 20000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [authenticated, user]);

  const feeRate = 0.001;
  const parsedAmount = Number(amount);
  const fee = Number.isFinite(parsedAmount) ? parsedAmount * feeRate : 0;
  const netAmount = Math.max(0, (Number.isFinite(parsedAmount) ? parsedAmount : 0) - fee);

  const commonProblems = useMemo(
    () => [
      'Why haven’t my withdrawals arrived?',
      'What is a “network address”?',
      'What if I sent to the wrong network?',
    ],
    [],
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Digital Currency Withdraw</h1>
              <p className="text-sm text-gray-500 mt-1">
                Balance {formatNumber(balance, 8)} {selectedSymbol}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-600">Currency</label>
              <select
                value={selectedSymbol}
                onChange={(e) => setSelectedSymbol(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              >
                {TOKENS.map((t) => (
                  <option key={t.symbol} value={t.symbol}>
                    {t.symbol} - {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-600">Select Transfer Network</label>
              <select
                value={selectedNetwork}
                onChange={(e) => setSelectedNetwork(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              >
                {token.networks.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-600">Withdrawal Quantity</label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Please enter the withdrawal amount"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setAmount(balance ? String(balance) : '')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-700"
                >
                  All
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-600">Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={`Recipient ${selectedSymbol} address`}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Service Charge {formatNumber(feeRate * 100, 2)}%</span>
              <span>Actual Arrival: {formatNumber(netAmount, 6)}</span>
            </div>

            <button
              type="button"
              disabled={!authenticated}
              className="w-full rounded-full bg-blue-600 text-white py-3 text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-60"
            >
              Withdraw
            </button>
            {!authenticated ? (
              <p className="text-xs text-gray-500">Log in to enable withdrawals.</p>
            ) : null}
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Common problem</h2>
            <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white">
              {commonProblems.map((item) => (
                <button
                  key={item}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-600 hover:bg-gray-50"
                >
                  <span>{item}</span>
                  <span className="text-gray-400">›</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
            <span>Recent withdrawal records</span>
            <a href="/history" className="text-blue-600 hover:text-blue-700">
              View history
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-gray-500">
              <thead>
                <tr className="text-left">
                  {['Type', 'Currency', 'Amount', 'Handling fee', 'Date', 'Address', 'State'].map((header) => (
                    <th key={header} className="py-2 font-semibold text-gray-500">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={7} className="py-6 text-center text-gray-400">
                    No records
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
