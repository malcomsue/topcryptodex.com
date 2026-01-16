import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export const runtime = 'nodejs';

function normalizeType(raw: string) {
  const value = raw.trim().toLowerCase();
  if (value === 'deposit' || value === 'withdrawal') return value;
  return '';
}

function normalizeState(raw: string) {
  return raw.trim().toLowerCase();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = String(searchParams.get('user_id') ?? '').trim();
  const type = normalizeType(String(searchParams.get('type') ?? ''));
  const state = normalizeState(String(searchParams.get('state') ?? ''));
  const start = String(searchParams.get('start') ?? '').trim();
  const end = String(searchParams.get('end') ?? '').trim();
  const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') ?? '50')));

  if (!userId) {
    return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
  }

  const results: Array<Record<string, any>> = [];

  if (!type || type === 'deposit') {
    let query = supabaseAdmin
      .from('deposits')
      .select('id, asset, amount, status, created_at')
      .eq('user_id', userId);
    if (state) query = query.eq('status', state);
    if (start) query = query.gte('created_at', start);
    if (end) query = query.lte('created_at', end);
    const { data } = await query.order('created_at', { ascending: false }).limit(limit);
    for (const row of data ?? []) {
      results.push({
        id: row.id,
        type: 'deposit',
        asset: row.asset,
        amount: row.amount,
        fee: 0,
        address: null,
        status: row.status,
        created_at: row.created_at,
      });
    }
  }

  if (!type || type === 'withdrawal') {
    let query = supabaseAdmin
      .from('withdrawals')
      .select('id, asset, amount, fee, address, status, created_at')
      .eq('user_id', userId);
    if (state) query = query.eq('status', state);
    if (start) query = query.gte('created_at', start);
    if (end) query = query.lte('created_at', end);
    const { data } = await query.order('created_at', { ascending: false }).limit(limit);
    for (const row of data ?? []) {
      results.push({
        id: row.id,
        type: 'withdrawal',
        asset: row.asset,
        amount: row.amount,
        fee: row.fee,
        address: row.address,
        status: row.status,
        created_at: row.created_at,
      });
    }
  }

  results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({ records: results.slice(0, limit) });
}
