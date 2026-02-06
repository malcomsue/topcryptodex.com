'use client';

import { useEffect, useState } from 'react';

type TreasurerInfo = {
  address: string;
  eth_balance: string;
  usdt_balance: string;
};

type UserWallet = {
  user_id: string;
  address: string;
  eth_balance: string;
  usdt_balance: string;
  needs_gas: boolean;
};

type WalletData = {
  treasurer: TreasurerInfo;
  user_wallets: UserWallet[];
  total_eth: string;
  total_usdt: string;
};

function formatBalance(value: string, digits = 6) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function truncateAddress(addr: string) {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

export default function AdminWalletBalancesPage() {
  const [loading, setLoading] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [data, setData] = useState<WalletData | null>(null);
  const [message, setMessage] = useState('');
  const [sweepResult, setSweepResult] = useState('');
  const [fundingAddress, setFundingAddress] = useState('');

  const fundGas = async (address: string) => {
    if (!confirm(`Send gas ETH to ${address}?`)) return;
    setFundingAddress(address);
    setMessage('');
    try {
      const res = await fetch('/api/admin/fund-gas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to fund gas');
      }
      setMessage(`Gas funded: ${json.amount} ETH sent — tx: ${json.tx_hash.slice(0, 16)}...`);
      await loadBalances();
    } catch (err: any) {
      setMessage(err?.message ?? 'Failed to fund gas');
    } finally {
      setFundingAddress('');
    }
  };

  const loadBalances = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/wallet-balances');
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to load balances');
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setMessage(err?.message ?? 'Failed to load balances');
    } finally {
      setLoading(false);
    }
  };

  const triggerSweep = async () => {
    if (!confirm('Are you sure you want to sweep all unsweped deposits now?')) return;
    setSweeping(true);
    setSweepResult('');
    try {
      const res = await fetch('/api/cron/sweep-deposits', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Sweep failed');
      }
      setSweepResult(
        `Swept: ${json.swept_count}, Failed: ${json.failed_count}`,
      );
      // Refresh balances after sweep
      await loadBalances();
    } catch (err: any) {
      setSweepResult(err?.message ?? 'Sweep failed');
    } finally {
      setSweeping(false);
    }
  };

  useEffect(() => {
    void loadBalances();
  }, []);

  const needsGasWallets = data?.user_wallets.filter((w) => w.needs_gas) ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        {/* Header */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h1 className="text-2xl font-semibold text-gray-900">Admin — Wallets</h1>
            <div className="flex items-center gap-4 text-sm">
              <a href="/admin" className="text-blue-600 hover:underline">Users</a>
              <a href="/admin/withdrawals" className="text-blue-600 hover:underline">Withdrawals</a>
              <a href="/admin/kyc" className="text-blue-600 hover:underline">KYC</a>
              <a href="/admin/conversations" className="text-blue-600 hover:underline">Conversations</a>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={loadBalances}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh Balances'}
            </button>
            <button
              onClick={triggerSweep}
              disabled={sweeping}
              className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
            >
              {sweeping ? 'Sweeping...' : 'Sweep Now'}
            </button>
          </div>

          {message && <p className="text-sm text-rose-600">{message}</p>}
          {sweepResult && (
            <p className={`text-sm ${sweepResult.includes('Failed') && !sweepResult.includes('Swept') ? 'text-rose-600' : 'text-green-600'}`}>
              {sweepResult}
            </p>
          )}
        </div>

        {data && (
          <>
            {/* Treasurer */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Treasurer Wallet</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-gray-100 p-4">
                  <p className="text-sm text-gray-500">Address</p>
                  <p className="font-mono text-sm text-gray-900 break-all">{data.treasurer.address}</p>
                </div>
                <div className="rounded-xl border border-gray-100 p-4">
                  <p className="text-sm text-gray-500">ETH Balance</p>
                  <p className="text-xl font-semibold text-gray-900">{formatBalance(data.treasurer.eth_balance)}</p>
                </div>
                <div className="rounded-xl border border-gray-100 p-4">
                  <p className="text-sm text-gray-500">USDT Balance</p>
                  <p className="text-xl font-semibold text-gray-900">{formatBalance(data.treasurer.usdt_balance, 2)}</p>
                </div>
              </div>
            </div>

            {/* Totals */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Totals (All Wallets)</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-gray-100 p-4">
                  <p className="text-sm text-gray-500">Total ETH</p>
                  <p className="text-xl font-semibold text-gray-900">{formatBalance(data.total_eth)}</p>
                </div>
                <div className="rounded-xl border border-gray-100 p-4">
                  <p className="text-sm text-gray-500">Total USDT</p>
                  <p className="text-xl font-semibold text-gray-900">{formatBalance(data.total_usdt, 2)}</p>
                </div>
              </div>
            </div>

            {/* Gas Alert */}
            {needsGasWallets.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-yellow-800 mb-2">
                  Wallets Needing Gas ({needsGasWallets.length})
                </h2>
                <p className="text-sm text-yellow-700 mb-3">
                  These wallets have USDT but insufficient ETH for gas. Use the &quot;Fund Gas&quot; button to send ETH, then sweep.
                </p>
                <div className="space-y-2 text-sm">
                  {needsGasWallets.map((w) => (
                    <div key={w.address} className="flex items-center gap-3">
                      <span className="font-mono text-yellow-800">
                        {truncateAddress(w.address)} — USDT: {formatBalance(w.usdt_balance, 2)}, ETH: {formatBalance(w.eth_balance)}
                      </span>
                      <button
                        onClick={() => fundGas(w.address)}
                        disabled={fundingAddress === w.address}
                        className="px-3 py-1 rounded bg-yellow-600 text-white text-xs font-medium hover:bg-yellow-700 disabled:opacity-50"
                      >
                        {fundingAddress === w.address ? 'Sending...' : 'Fund Gas'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* User Wallets Table */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 overflow-x-auto">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                User Wallets ({data.user_wallets.length})
              </h2>
              <table className="min-w-full text-sm">
                <thead className="text-left text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="py-3 pr-4">Address</th>
                    <th className="py-3 pr-4">User ID</th>
                    <th className="py-3 pr-4 text-right">ETH Balance</th>
                    <th className="py-3 pr-4 text-right">USDT Balance</th>
                    <th className="py-3">Status</th>
                    <th className="py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.user_wallets.length > 0 ? (
                    data.user_wallets.map((w) => (
                      <tr key={w.address} className={w.needs_gas ? 'bg-yellow-50' : ''}>
                        <td className="py-4 pr-4">
                          <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                            {truncateAddress(w.address)}
                          </span>
                        </td>
                        <td className="py-4 pr-4">
                          <span className="text-xs text-gray-600">{w.user_id.slice(0, 20)}...</span>
                        </td>
                        <td className="py-4 pr-4 text-right font-mono">{formatBalance(w.eth_balance)}</td>
                        <td className="py-4 pr-4 text-right font-mono">{formatBalance(w.usdt_balance, 2)}</td>
                        <td className="py-4">
                          {w.needs_gas ? (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                              Needs Gas
                            </span>
                          ) : Number(w.eth_balance) === 0 && Number(w.usdt_balance) === 0 ? (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-500">
                              Empty
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                              OK
                            </span>
                          )}
                        </td>
                        <td className="py-4">
                          {w.needs_gas && (
                            <button
                              onClick={() => fundGas(w.address)}
                              disabled={fundingAddress === w.address}
                              className="px-3 py-1.5 rounded bg-yellow-600 text-white text-xs font-medium hover:bg-yellow-700 disabled:opacity-50"
                            >
                              {fundingAddress === w.address ? 'Sending...' : 'Fund Gas'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="py-8 text-gray-500 text-center" colSpan={6}>
                        {loading ? 'Loading wallet balances...' : 'No user wallets found.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
