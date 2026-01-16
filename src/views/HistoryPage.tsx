'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';

type HistoryRecord = {
  id: string;
  type: 'deposit' | 'withdrawal';
  asset: string;
  amount: number | string;
  fee: number | string;
  address?: string | null;
  status: string;
  created_at: string;
};

function formatNumber(value: number | string, digits = 6) {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export default function HistoryPage() {
  const { user, authenticated } = usePrivy();
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [type, setType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [state, setState] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [loading, setLoading] = useState(false);

  const userId = (user as any)?.id;

  useEffect(() => {
    if (!authenticated || !userId) {
      setRecords([]);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          user_id: String(userId),
          type,
        });
        if (state) params.set('state', state);
        if (start) params.set('start', start);
        if (end) params.set('end', end);
        const res = await fetch(`/api/history?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setRecords(data?.records ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [authenticated, userId, type, state, start, end]);

  const tableRows = useMemo(() => records, [records]);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
          <div className="flex items-center gap-2 rounded-full border border-gray-200 px-3 py-2">
            <span className="text-gray-400">Time</span>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="text-sm text-gray-600 outline-none"
            />
            <span className="text-gray-300">to</span>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="text-sm text-gray-600 outline-none"
            />
          </div>

          <div className="flex items-center gap-2 rounded-full border border-gray-200 px-3 py-2">
            <span className="text-gray-400">Type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'deposit' | 'withdrawal')}
              className="text-sm text-gray-600 outline-none bg-transparent"
            >
              <option value="deposit">Deposit</option>
              <option value="withdrawal">Withdrawal</option>
            </select>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-gray-200 px-3 py-2">
            <span className="text-gray-400">State</span>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="text-sm text-gray-600 outline-none bg-transparent"
            >
              <option value="">Select</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="confirmed">Confirmed</option>
              <option value="credited">Credited</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="canceled">Canceled</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setStart('');
              setEnd('');
              setState('');
            }}
            className="rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Reset
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-7 text-xs text-gray-500 border-b border-gray-100 px-4 py-3">
            {['Order Number', 'Type', 'Currency', 'Amount', 'Handling fee', 'Date', 'State'].map((header) => (
              <div key={header} className="font-semibold">
                {header}
              </div>
            ))}
          </div>
          <div className="min-h-[360px] flex items-center justify-center text-sm text-gray-400">
            {loading ? 'Loading…' : tableRows.length === 0 ? 'No Data' : null}
          </div>
          {tableRows.length > 0 ? (
            <div className="divide-y divide-gray-100 text-xs text-gray-600">
              {tableRows.map((row) => (
                <div key={row.id} className="grid grid-cols-7 px-4 py-3">
                  <div className="truncate">{row.id.slice(0, 10)}</div>
                  <div className="capitalize">{row.type}</div>
                  <div>{row.asset}</div>
                  <div>{formatNumber(row.amount, 6)}</div>
                  <div>{formatNumber(row.fee ?? 0, 6)}</div>
                  <div>{new Date(row.created_at).toLocaleString()}</div>
                  <div className="capitalize">{row.status}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
