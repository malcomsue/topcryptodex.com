import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

function isAuthorized(request: Request) {
  if (!ADMIN_TOKEN) return false;
  const header = request.headers.get('x-admin-token') ?? '';
  const token = new URL(request.url).searchParams.get('token') ?? '';
  return header === ADMIN_TOKEN || token === ADMIN_TOKEN;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = String(searchParams.get('q') ?? '').trim();
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '50')));

  let query = supabaseAdmin
    .from('user_profiles')
    .select('id, username, full_name, email, phone, kyc_status, kyc_document_url, kyc_document_type')
    .limit(limit);

  if (q) {
    const escaped = q.replace(/%/g, '\\%').replace(/_/g, '\\_');
    query = query.or(
      `username.ilike.%${escaped}%,full_name.ilike.%${escaped}%,email.ilike.%${escaped}%,phone.ilike.%${escaped}%,id.ilike.%${escaped}%`,
    );
  }

  const { data: users, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 });
  }

  const userIds = (users ?? []).map((u) => u.id);
  const { data: balances } = userIds.length
    ? await supabaseAdmin
        .from('balances')
        .select('user_id, asset, available, locked, account_type')
        .in('user_id', userIds)
    : { data: [] };

  const balancesByUser = new Map<string, Array<any>>();
  for (const row of balances ?? []) {
    const list = balancesByUser.get(row.user_id) ?? [];
    list.push(row);
    balancesByUser.set(row.user_id, list);
  }

  const totalsByAsset: Record<string, number> = {};
  for (const row of balances ?? []) {
    const asset = String(row.asset);
    const total = Number(row.available ?? 0) + Number(row.locked ?? 0);
    totalsByAsset[asset] = (totalsByAsset[asset] ?? 0) + total;
  }

  const result = (users ?? []).map((user) => {
    const userBalances = balancesByUser.get(user.id) ?? [];
    const total = userBalances.reduce(
      (sum, b) => sum + Number(b.available ?? 0) + Number(b.locked ?? 0),
      0,
    );
    return {
      ...user,
      balances: userBalances,
      total,
    };
  });

  return NextResponse.json({ users: result, totals: totalsByAsset });
}
