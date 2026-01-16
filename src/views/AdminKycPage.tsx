'use client';

import { useEffect, useState } from 'react';

type KycRow = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  kyc_status?: string | null;
  kyc_document_url?: string | null;
  kyc_document_type?: string | null;
  kyc_submitted_at?: string | null;
};

const STATUS_OPTIONS = ['pending', 'approved', 'rejected'] as const;

export default function AdminKycPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<KycRow[]>([]);
  const [message, setMessage] = useState('');
  const [updatingId, setUpdatingId] = useState('');

  const loadKyc = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`/api/admin/kyc?q=${encodeURIComponent(query)}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to load KYC');
      }
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch (error: any) {
      setMessage(error?.message ?? 'Failed to load KYC');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadKyc();
  }, []);

  const updateStatus = async (userId: string, status: string) => {
    setUpdatingId(userId);
    setMessage('');
    try {
      const res = await fetch('/api/admin/kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, status }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to update status');
      }
      setUsers((prev) =>
        prev.map((user) => (user.id === userId ? { ...user, kyc_status: status } : user)),
      );
    } catch (error: any) {
      setMessage(error?.message ?? 'Failed to update status');
    } finally {
      setUpdatingId('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-900">Admin — KYC Review</h1>
            <div className="flex items-center gap-4 text-sm">
              <a href="/admin" className="text-blue-600 hover:underline">
                Users
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
              placeholder="Search by name, email, phone"
              className="px-4 py-3 border border-gray-200 rounded-lg text-sm"
            />
            <button
              onClick={loadKyc}
              className="px-4 py-3 rounded-lg bg-black text-white text-sm font-semibold"
            >
              {loading ? 'Loading…' : 'Search'}
            </button>
          </div>
          {message && <p className="text-sm text-rose-600">{message}</p>}
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-6 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="py-2">User</th>
                <th className="py-2">Contact</th>
                <th className="py-2">Document</th>
                <th className="py-2">Status</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.length ? (
                users.map((user) => (
                  <tr key={user.id}>
                    <td className="py-3">
                      <div className="font-semibold text-gray-900">
                        {user.full_name || user.email || user.phone || user.id}
                      </div>
                      <div className="text-xs text-gray-500">{user.id}</div>
                    </td>
                    <td className="py-3 text-gray-600">
                      <div>{user.email ?? '—'}</div>
                      <div className="text-xs text-gray-400">{user.phone ?? '—'}</div>
                    </td>
                    <td className="py-3 text-gray-600">
                      {user.kyc_document_url ? (
                        <a
                          href={user.kyc_document_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          View {user.kyc_document_type ? `(${user.kyc_document_type})` : ''}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 text-gray-600">
                      {user.kyc_status ?? 'pending'}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <select
                          defaultValue={user.kyc_status ?? 'pending'}
                          className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
                          onChange={(event) => updateStatus(user.id, event.target.value)}
                          disabled={updatingId === user.id}
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                        {updatingId === user.id ? (
                          <span className="text-xs text-gray-400">Updating…</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="py-6 text-gray-500" colSpan={5}>
                    No KYC submissions found.
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
