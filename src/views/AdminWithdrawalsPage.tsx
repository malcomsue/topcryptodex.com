'use client';

import { useEffect, useState } from 'react';

type UserProfile = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  kyc_status?: string | null;
};

type UserBalance = {
  user_id: string;
  asset: string;
  available: number | string;
  locked: number | string;
  account_type: string;
};

type WithdrawalRow = {
  id: string;
  user_id: string;
  asset: string;
  amount: number | string;
  fee: number | string;
  address: string;
  status: string;
  created_at: string;
  updated_at: string;
  tx_hash?: string | null;
  network_fee?: number | string | null;
  user_profile?: UserProfile | null;
  user_balances?: UserBalance[];
};

const STATUS_FILTERS = ['pending', 'approved', 'rejected', 'all'] as const;

function formatNumber(value: number | string, digits = 6) {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString();
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    processing: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${colors[status] ?? 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}

function KycBadge({ status }: { status?: string | null }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs ${colors[status ?? 'pending'] ?? 'bg-gray-100 text-gray-700'}`}>
      KYC: {status ?? 'pending'}
    </span>
  );
}

export default function AdminWithdrawalsPage() {
  const [status, setStatus] = useState<string>('pending');
  const [loading, setLoading] = useState(false);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [message, setMessage] = useState('');
  const [processingId, setProcessingId] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadWithdrawals = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`/api/admin/withdrawals?status=${status}&include_balances=true`);
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = await res.json();
      setWithdrawals(data.withdrawals ?? []);
    } catch (error: any) {
      setMessage(error?.message ?? 'Failed to load withdrawals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWithdrawals();
  }, [status]);

  const handleAction = async (withdrawalId: string, action: 'approve' | 'reject') => {
    const confirmMsg =
      action === 'approve'
        ? 'Are you sure you want to APPROVE this withdrawal? The user balance will be deducted.'
        : 'Are you sure you want to REJECT this withdrawal?';

    if (!confirm(confirmMsg)) return;

    const reason =
      action === 'reject' ? prompt('Reason for rejection (optional):') ?? '' : '';

    setProcessingId(withdrawalId);
    setMessage('');
    try {
      const res = await fetch('/api/admin/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ withdrawal_id: withdrawalId, action, reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process withdrawal');
      }
      // Update local state
      setWithdrawals((prev) =>
        prev.map((w) =>
          w.id === withdrawalId
            ? {
                ...w,
                status: data.tx_hash ? 'processing' : action === 'approve' ? 'approved' : 'rejected',
                tx_hash: data.tx_hash ?? w.tx_hash,
                network_fee: data.network_fee ?? w.network_fee,
              }
            : w
        )
      );
      const extra = data.on_chain_error
        ? ` (on-chain error: ${data.on_chain_error})`
        : data.tx_hash
          ? ` — tx: ${data.tx_hash.slice(0, 12)}...`
          : '';
      setMessage(`Withdrawal ${action}d successfully${extra}`);
    } catch (error: any) {
      setMessage(error?.message ?? 'Failed to process withdrawal');
    } finally {
      setProcessingId('');
    }
  };

  const handleRetry = async (withdrawalId: string) => {
    if (!confirm('Retry sending this withdrawal on-chain?')) return;
    setProcessingId(withdrawalId);
    setMessage('');
    try {
      const res = await fetch('/api/admin/withdrawals/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ withdrawal_id: withdrawalId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Retry failed');
      }
      setWithdrawals((prev) =>
        prev.map((w) =>
          w.id === withdrawalId
            ? { ...w, status: 'processing', tx_hash: data.tx_hash, network_fee: data.network_fee }
            : w
        )
      );
      setMessage(`Retry successful — tx: ${data.tx_hash.slice(0, 12)}...`);
    } catch (error: any) {
      setMessage(error?.message ?? 'Retry failed');
    } finally {
      setProcessingId('');
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        {/* Header */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h1 className="text-2xl font-semibold text-gray-900">Admin — Withdrawals</h1>
            <div className="flex items-center gap-4 text-sm">
              <a href="/admin" className="text-blue-600 hover:underline">
                Users
              </a>
              <a href="/admin/wallets" className="text-blue-600 hover:underline">
                Wallets
              </a>
              <a href="/admin/kyc" className="text-blue-600 hover:underline">
                KYC
              </a>
              <a href="/admin/conversations" className="text-blue-600 hover:underline">
                Conversations
              </a>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  status === s
                    ? 'bg-black text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
            <button
              onClick={loadWithdrawals}
              disabled={loading}
              className="ml-auto px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {message && (
            <p
              className={`text-sm ${
                message.includes('success') ? 'text-green-600' : 'text-rose-600'
              }`}
            >
              {message}
            </p>
          )}
        </div>

        {/* Withdrawals Table */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-gray-500 border-b border-gray-100">
              <tr>
                <th className="py-3 pr-4">User</th>
                <th className="py-3 pr-4">Asset</th>
                <th className="py-3 pr-4">Amount</th>
                <th className="py-3 pr-4">Fee</th>
                <th className="py-3 pr-4">Address</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Date</th>
                <th className="py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {withdrawals.length ? (
                withdrawals.map((w) => (
                  <>
                    <tr
                      key={w.id}
                      className={`cursor-pointer hover:bg-gray-50 ${
                        expandedId === w.id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => toggleExpand(w.id)}
                    >
                      <td className="py-4 pr-4">
                        <div className="font-semibold text-gray-900">
                          {w.user_profile?.full_name ||
                            w.user_profile?.email ||
                            w.user_id.slice(0, 12) + '...'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {w.user_profile?.email ?? w.user_id.slice(0, 20)}
                        </div>
                      </td>
                      <td className="py-4 pr-4 font-medium">{w.asset}</td>
                      <td className="py-4 pr-4 font-mono">{formatNumber(w.amount)}</td>
                      <td className="py-4 pr-4 font-mono text-gray-500">
                        {formatNumber(w.fee)}
                      </td>
                      <td className="py-4 pr-4">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                          {w.address.slice(0, 12)}...{w.address.slice(-6)}
                        </span>
                      </td>
                      <td className="py-4 pr-4">
                        <StatusBadge status={w.status} />
                      </td>
                      <td className="py-4 pr-4 text-gray-500 text-xs">
                        {formatDate(w.created_at)}
                      </td>
                      <td className="py-4">
                        {w.status === 'pending' && (
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleAction(w.id, 'approve')}
                              disabled={processingId === w.id}
                              className="px-3 py-1.5 rounded bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                            >
                              {processingId === w.id ? '...' : 'Approve'}
                            </button>
                            <button
                              onClick={() => handleAction(w.id, 'reject')}
                              disabled={processingId === w.id}
                              className="px-3 py-1.5 rounded bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {/* Expanded User Details */}
                    {expandedId === w.id && (
                      <tr key={`${w.id}-details`}>
                        <td colSpan={8} className="bg-gray-50 px-6 py-4">
                          <div className="grid md:grid-cols-2 gap-6">
                            {/* User Profile */}
                            <div className="space-y-2">
                              <h4 className="font-semibold text-gray-900">User Details</h4>
                              <div className="bg-white rounded-lg p-4 space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-500">User ID</span>
                                  <span className="font-mono text-xs">{w.user_id}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Name</span>
                                  <span>{w.user_profile?.full_name ?? '—'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Email</span>
                                  <span>{w.user_profile?.email ?? '—'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Phone</span>
                                  <span>{w.user_profile?.phone ?? '—'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-500">KYC Status</span>
                                  <KycBadge status={w.user_profile?.kyc_status} />
                                </div>
                              </div>
                            </div>

                            {/* User Balances */}
                            <div className="space-y-2">
                              <h4 className="font-semibold text-gray-900">User Balances</h4>
                              <div className="bg-white rounded-lg p-4">
                                {w.user_balances && w.user_balances.length > 0 ? (
                                  <table className="w-full text-sm">
                                    <thead className="text-gray-500 text-xs">
                                      <tr>
                                        <th className="text-left py-1">Asset</th>
                                        <th className="text-left py-1">Account</th>
                                        <th className="text-right py-1">Available</th>
                                        <th className="text-right py-1">Locked</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {w.user_balances.map((bal, idx) => (
                                        <tr key={idx}>
                                          <td className="py-2 font-medium">{bal.asset}</td>
                                          <td className="py-2 text-gray-500">{bal.account_type}</td>
                                          <td className="py-2 text-right font-mono">
                                            {formatNumber(bal.available)}
                                          </td>
                                          <td className="py-2 text-right font-mono text-gray-500">
                                            {formatNumber(bal.locked)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  <p className="text-gray-500 text-sm">No balances found</p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Withdrawal Details */}
                          <div className="mt-4 space-y-2">
                            <h4 className="font-semibold text-gray-900">Withdrawal Details</h4>
                            <div className="bg-white rounded-lg p-4 space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Withdrawal ID</span>
                                <span className="font-mono text-xs">{w.id}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Full Address</span>
                                <span className="font-mono text-xs break-all">{w.address}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Amount</span>
                                <span className="font-mono">
                                  {formatNumber(w.amount)} {w.asset}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Fee</span>
                                <span className="font-mono">
                                  {formatNumber(w.fee)} {w.asset}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Total Deduction</span>
                                <span className="font-mono font-semibold">
                                  {formatNumber(Number(w.amount) + Number(w.fee))} {w.asset}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Created</span>
                                <span>{formatDate(w.created_at)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Updated</span>
                                <span>{formatDate(w.updated_at)}</span>
                              </div>
                              {w.tx_hash && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500">TX Hash</span>
                                  <span className="font-mono text-xs break-all">{w.tx_hash}</span>
                                </div>
                              )}
                              {w.network_fee && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Network Fee</span>
                                  <span className="font-mono">{formatNumber(w.network_fee)} ETH</span>
                                </div>
                              )}
                              {w.status === 'approved' && !w.tx_hash && ['ETH', 'USDT'].includes(w.asset) && (
                                <div className="pt-2">
                                  <button
                                    onClick={() => handleRetry(w.id)}
                                    disabled={processingId === w.id}
                                    className="px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                                  >
                                    {processingId === w.id ? 'Retrying...' : 'Retry On-Chain Send'}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              ) : (
                <tr>
                  <td className="py-8 text-gray-500 text-center" colSpan={8}>
                    {loading ? 'Loading withdrawals...' : 'No withdrawals found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
