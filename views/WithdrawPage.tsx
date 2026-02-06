'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';

type TokenOption = {
  symbol: string;
  name: string;
  networks: string[];
};

type WithdrawalRecord = {
  id: string;
  asset: string;
  amount: number | string;
  fee: number | string;
  address: string;
  status: string;
  created_at: string;
};

const TOKENS: TokenOption[] = [
  { symbol: 'BTC', name: 'Bitcoin', networks: ['BTC', 'BTC (SegWit)', 'BTC (Legacy)'] },
  { symbol: 'ETH', name: 'Ethereum', networks: ['ERC20'] },
  { symbol: 'USDT', name: 'Tether', networks: ['ERC20', 'TRC20'] },
  { symbol: 'SOL', name: 'Solana', networks: ['SOL'] },
  { symbol: 'XRP', name: 'Ripple', networks: ['XRP'] },
];

function formatNumber(value: number | string, digits = 6) {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export default function WithdrawPage() {
  const { user, authenticated, getAccessToken } = usePrivy();
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [selectedSymbol, setSelectedSymbol] = useState('BTC');
  const [selectedNetwork, setSelectedNetwork] = useState('BTC');
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);

  const token = TOKENS.find((t) => t.symbol === selectedSymbol) ?? TOKENS[0];
  const balance = balances[selectedSymbol] ?? 0;

  useEffect(() => {
    setSelectedNetwork(token.networks[0] ?? '');
  }, [token.symbol]);

  useEffect(() => {
    const userId = (user as any)?.id;
    if (!authenticated || !userId) {
      setBalances({});
      setWithdrawals([]);
      return;
    }

    let cancelled = false;
    async function loadData() {
      try {
        const authToken = await getAccessToken();
        const headers: Record<string, string> = {};
        if (authToken) {
          headers.Authorization = `Bearer ${authToken}`;
        }

        // Load balances and withdrawals in parallel
        const [balancesRes, withdrawalsRes] = await Promise.all([
          fetch(`/api/balances?account_type=funding`, { cache: 'no-store', headers }),
          fetch(`/api/withdrawals?limit=10`, { cache: 'no-store', headers }),
        ]);

        if (cancelled) return;

        if (balancesRes.ok) {
          const data = await balancesRes.json();
          const map: Record<string, number> = {};
          for (const row of data?.balances ?? []) {
            const asset = String(row.asset);
            map[asset] = Number(row.available ?? 0);
          }
          setBalances(map);
        }

        if (withdrawalsRes.ok) {
          const data = await withdrawalsRes.json();
          setWithdrawals(data?.withdrawals ?? []);
        }
      } catch {
        // ignore
      }
    }

    loadData();
    const timer = setInterval(loadData, 20000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [authenticated, user, getAccessToken]);

  const feeRate = 0.001;
  const parsedAmount = Number(amount);
  const fee = Number.isFinite(parsedAmount) ? Math.max(parsedAmount * feeRate, 0.0001) : 0;
  const netAmount = Math.max(0, (Number.isFinite(parsedAmount) ? parsedAmount : 0) - fee);

  async function submitWithdrawal() {
    setError(null);
    setSuccess(null);

    if (!authenticated) {
      return setError('Please log in to withdraw');
    }

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return setError('Enter a valid amount');
    }

    if (!address || address.trim().length < 10) {
      return setError('Enter a valid withdrawal address');
    }

    if (amt + fee > balance) {
      return setError('Insufficient balance');
    }

    setLoading(true);
    try {
      const authToken = await getAccessToken();
      if (!authToken) throw new Error('Please log in');

      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          asset: selectedSymbol,
          amount: amt,
          address: address.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? 'Failed to submit withdrawal');
      }

      setSuccess('Withdrawal request submitted. Pending admin approval.');
      setAmount('');
      setAddress('');

      // Reload withdrawals
      const withdrawalsRes = await fetch(`/api/withdrawals?limit=10`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (withdrawalsRes.ok) {
        const wData = await withdrawalsRes.json();
        setWithdrawals(wData?.withdrawals ?? []);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to submit withdrawal');
    } finally {
      setLoading(false);
    }
  }

  const commonProblems = useMemo(
    () => [
      "Why haven't my withdrawals arrived?",
      'What is a "network address"?',
      'What if I sent to the wrong network?',
    ],
    []
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
                  onClick={() => setAmount(balance ? String(Math.max(0, balance - fee)) : '')}
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
              <span>Service Charge: {formatNumber(fee, 6)} {selectedSymbol}</span>
              <span>Actual Arrival: {formatNumber(netAmount, 6)} {selectedSymbol}</span>
            </div>

            <button
              type="button"
              onClick={submitWithdrawal}
              disabled={!authenticated || loading}
              className="w-full rounded-full bg-blue-600 text-white py-3 text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-60"
            >
              {loading ? 'Submitting...' : 'Withdraw'}
            </button>

            {!authenticated ? (
              <p className="text-xs text-gray-500">Log in to enable withdrawals.</p>
            ) : null}

            {error ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
                {success}
              </div>
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
                  {['Currency', 'Amount', 'Fee', 'Address', 'Status', 'Date'].map((header) => (
                    <th key={header} className="py-2 font-semibold text-gray-500 pr-4">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {withdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-gray-400">
                      No records
                    </td>
                  </tr>
                ) : (
                  withdrawals.map((row) => (
                    <tr key={row.id} className="border-t border-gray-100">
                      <td className="py-3 pr-4">{row.asset}</td>
                      <td className="py-3 pr-4">{formatNumber(row.amount, 6)}</td>
                      <td className="py-3 pr-4">{formatNumber(row.fee, 6)}</td>
                      <td className="py-3 pr-4 font-mono text-[10px]">
                        {row.address.slice(0, 10)}...{row.address.slice(-6)}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                            row.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-700'
                              : row.status === 'approved'
                                ? 'bg-green-100 text-green-700'
                                : row.status === 'rejected'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4">{new Date(row.created_at).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
