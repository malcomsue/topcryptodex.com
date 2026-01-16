'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';

type UserRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  email?: string | null;
  phone?: string | null;
  kyc_status?: string | null;
  kyc_document_url?: string | null;
  kyc_document_type?: string | null;
  balances: Array<{ asset: string; available: string | number; locked: string | number }>;
  total: number;
};

const ASSETS = ['USDT', 'BTC', 'XRP', 'ETH'];

export default function AdminUsersPage() {
  const { user, authenticated } = usePrivy();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedAsset, setSelectedAsset] = useState('USDT');
  const [available, setAvailable] = useState('');
  const [locked, setLocked] = useState('');
  const [message, setMessage] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to load users');
      }
      const data = await res.json();
      setUsers(data.users ?? []);
      setTotals(data.totals ?? {});
    } catch (err: any) {
      setMessage(err?.message ?? 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const updateBalance = async () => {
    if (!selectedUserId) {
      setMessage('Select a user to update.');
      return;
    }
    setMessage('');
    try {
      const res = await fetch('/api/admin/balances', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: selectedUserId,
          asset: selectedAsset,
          available: Number(available || 0),
          locked: Number(locked || 0),
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to update balance');
      }
      setMessage('Balance updated.');
      await loadUsers();
    } catch (err: any) {
      setMessage(err?.message ?? 'Failed to update balance');
    }
  };

  const syncProfile = async () => {
    if (!authenticated || !user) {
      setMessage('No authenticated user found.');
      return;
    }
    const email =
      (user as any)?.email?.address ??
      (user as any)?.email ??
      null;
    const phone =
      (user as any)?.phone?.number ??
      (user as any)?.phone ??
      null;
    try {
      const res = await fetch('/api/profile/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: (user as any).id,
          email,
          phone,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to sync profile');
      }
      setMessage('Profile sync triggered.');
    } catch (err: any) {
      setMessage(err?.message ?? 'Failed to sync profile');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-900">Admin — Users & Balances</h1>
            <div className="flex items-center gap-4 text-sm">
              <a href="/admin/kyc" className="text-blue-600 hover:underline">
                Review KYC
              </a>
              <a href="/admin/conversations" className="text-blue-600 hover:underline">
                Conversations
              </a>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email"
              className="px-4 py-3 border border-gray-200 rounded-lg text-sm"
            />
            <button
              onClick={loadUsers}
              className="px-4 py-3 rounded-lg bg-black text-white text-sm font-semibold"
            >
              {loading ? 'Loading…' : 'Search'}
            </button>
            <button
              onClick={syncProfile}
              className="px-4 py-3 rounded-lg border border-gray-200 text-sm font-semibold text-gray-800"
            >
              Sync current user
            </button>
          </div>
          {message && <p className="text-sm text-rose-600">{message}</p>}
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Totals</h2>
          <div className="grid gap-3 sm:grid-cols-4 text-sm">
            {Object.keys(totals).length ? (
              Object.entries(totals).map(([asset, total]) => (
                <div key={asset} className="rounded-xl border border-gray-100 p-3">
                  <p className="text-gray-500">{asset}</p>
                  <p className="text-gray-900 font-semibold">{total.toFixed(4)}</p>
                </div>
              ))
            ) : (
              <p className="text-gray-500">No totals yet.</p>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Update Balance</h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-lg text-sm"
            >
              <option value="">Select user</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name || user.username || user.email || user.id}
                </option>
              ))}
            </select>
            <select
              value={selectedAsset}
              onChange={(e) => setSelectedAsset(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-lg text-sm"
            >
              {ASSETS.map((asset) => (
                <option key={asset} value={asset}>
                  {asset}
                </option>
              ))}
            </select>
            <input
              value={available}
              onChange={(e) => setAvailable(e.target.value)}
              placeholder="Available"
              className="px-4 py-3 border border-gray-200 rounded-lg text-sm"
            />
            <input
              value={locked}
              onChange={(e) => setLocked(e.target.value)}
              placeholder="Locked"
              className="px-4 py-3 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <button onClick={updateBalance} className="px-4 py-3 rounded-lg bg-gray-900 text-white text-sm font-semibold">
            Update balance
          </button>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-6 overflow-x-auto">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Users</h2>
          <table className="min-w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="py-2">User</th>
                <th className="py-2">Email</th>
                <th className="py-2">Phone</th>
                <th className="py-2">KYC</th>
                <th className="py-2">Document</th>
                <th className="py-2">Balances</th>
                <th className="py-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="py-3">
                    <div className="font-semibold text-gray-900">
                      {user.full_name || user.username || user.id}
                    </div>
                    <div className="text-xs text-gray-500">{user.username ?? user.id}</div>
                  </td>
                  <td className="py-3 text-gray-600">{user.email ?? '—'}</td>
                  <td className="py-3 text-gray-600">{user.phone ?? '—'}</td>
                  <td className="py-3 text-gray-600">
                    {user.kyc_status ?? '—'}
                    {user.kyc_document_type ? (
                      <span className="block text-xs text-gray-400">{user.kyc_document_type}</span>
                    ) : null}
                  </td>
                  <td className="py-3 text-gray-600">
                    {user.kyc_document_url ? (
                      <a
                        href={user.kyc_document_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        View
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      {(user.balances ?? []).map((balance) => (
                        <span key={`${user.id}-${balance.asset}`} className="px-2 py-1 rounded-full bg-gray-100 text-xs">
                          {balance.asset}: {Number(balance.available ?? 0).toFixed(4)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 font-semibold text-gray-900">{user.total.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
