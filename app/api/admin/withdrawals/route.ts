import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendETH, sendUSDT } from '@/lib/blockchain/ethereum';

export const runtime = 'nodejs';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

function isAuthorized(request: Request) {
  if (!ADMIN_TOKEN) return false;
  const header = request.headers.get('x-admin-token') ?? '';
  const cookie = request.headers.get('cookie')?.match(/admin_auth=([^;]+)/)?.[1] ?? '';
  return header === ADMIN_TOKEN || cookie === ADMIN_TOKEN;
}

// GET: List withdrawals for admin review (with user details and balances)
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? 'pending';
  const includeBalances = searchParams.get('include_balances') === 'true';
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '50')));

  let query = supabaseAdmin
    .from('withdrawals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data: withdrawals, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'Failed to load withdrawals' }, { status: 500 });
  }

  // Fetch user profiles for display
  const userIds = [...new Set((withdrawals ?? []).map((w) => w.user_id))];

  let profileMap = new Map<string, any>();
  let balancesMap = new Map<string, any[]>();

  if (userIds.length > 0) {
    // Fetch user profiles
    const { data: profiles } = await supabaseAdmin
      .from('user_profiles')
      .select('id, full_name, email, phone, kyc_status')
      .in('id', userIds);

    profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    // Fetch user balances if requested
    if (includeBalances) {
      const { data: balances } = await supabaseAdmin
        .from('balances')
        .select('user_id, asset, available, locked, account_type')
        .in('user_id', userIds);

      // Group balances by user_id
      for (const balance of balances ?? []) {
        const existing = balancesMap.get(balance.user_id) ?? [];
        existing.push(balance);
        balancesMap.set(balance.user_id, existing);
      }
    }
  }

  // Combine data
  const result = (withdrawals ?? []).map((w) => ({
    ...w,
    user_profile: profileMap.get(w.user_id) ?? null,
    user_balances: includeBalances ? balancesMap.get(w.user_id) ?? [] : undefined,
  }));

  return NextResponse.json({ withdrawals: result });
}

// POST: Approve or reject withdrawal
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const withdrawalId = String(body?.withdrawal_id ?? '').trim();
  const action = String(body?.action ?? '').trim().toLowerCase();
  const reason = String(body?.reason ?? '').trim();

  if (!withdrawalId) {
    return NextResponse.json({ error: 'Missing withdrawal_id' }, { status: 400 });
  }

  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action. Use "approve" or "reject"' }, { status: 400 });
  }

  if (action === 'approve') {
    // Use atomic function to approve and deduct balance
    const { data, error } = await supabaseAdmin.rpc('approve_withdrawal_atomic', {
      p_withdrawal_id: withdrawalId,
      p_admin_notes: reason || null,
    });

    if (error) {
      console.error('Approve withdrawal error:', error);
      return NextResponse.json({ error: 'Database error during approval' }, { status: 500 });
    }

    const result = data as any;
    if (result?.error) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
    }

    // After DB approval, attempt on-chain execution for ETH/USDT
    const { data: withdrawal } = await supabaseAdmin
      .from('withdrawals')
      .select('id, asset, amount, address')
      .eq('id', withdrawalId)
      .single();

    let txResult: { hash: string; gasCost: string } | null = null;
    let onChainError: string | null = null;

    if (withdrawal) {
      const asset = withdrawal.asset?.toUpperCase();
      try {
        if (asset === 'ETH') {
          txResult = await sendETH(withdrawal.address, String(withdrawal.amount));
        } else if (asset === 'USDT') {
          txResult = await sendUSDT(withdrawal.address, String(withdrawal.amount));
        }
        // BTC, XRP, SOL etc. — leave as approved for manual handling

        if (txResult) {
          await supabaseAdmin
            .from('withdrawals')
            .update({
              tx_hash: txResult.hash,
              network_fee: txResult.gasCost,
              status: 'processing',
              updated_at: new Date().toISOString(),
            })
            .eq('id', withdrawalId);
        }
      } catch (err: any) {
        onChainError = err?.message ?? 'On-chain transaction failed';
        console.error('On-chain withdrawal error:', err);
        // Status stays 'approved' — admin can retry
      }
    }

    return NextResponse.json({
      ok: true,
      action: 'approved',
      result,
      tx_hash: txResult?.hash ?? null,
      network_fee: txResult?.gasCost ?? null,
      on_chain_error: onChainError,
    });
  } else {
    // Reject withdrawal
    const { data, error } = await supabaseAdmin.rpc('reject_withdrawal_atomic', {
      p_withdrawal_id: withdrawalId,
      p_reason: reason || null,
    });

    if (error) {
      console.error('Reject withdrawal error:', error);
      return NextResponse.json({ error: 'Database error during rejection' }, { status: 500 });
    }

    const result = data as any;
    if (result?.error) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
    }

    return NextResponse.json({ ok: true, action: 'rejected', reason });
  }
}
