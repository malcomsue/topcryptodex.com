import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  deriveUserWallet,
  getTreasurerAddress,
  sweepETH,
  sweepUSDT,
  getETHBalance,
  getUSDTBalance,
} from '@/lib/blockchain/ethereum';

export const runtime = 'nodejs';

const CRON_SECRET = process.env.CRON_SECRET;

function authOk(request: Request) {
  if (!CRON_SECRET) return true;
  const header = request.headers.get('x-cron-secret') ?? '';
  const cookie = request.headers.get('cookie')?.match(/admin_auth=([^;]+)/)?.[1] ?? '';
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? '';
  return header === CRON_SECRET || token === CRON_SECRET || cookie === process.env.ADMIN_TOKEN;
}

type SweepResult = {
  deposit_id: string;
  user_id: string;
  asset: string;
  status: 'swept' | 'failed' | 'skipped';
  sweep_tx?: string;
  amount?: string;
  error?: string;
};

export async function POST(request: Request) {
  if (!authOk(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const treasurerAddress = getTreasurerAddress();
  const results: SweepResult[] = [];
  let sweptCount = 0;
  let failedCount = 0;

  // Fetch credited deposits that haven't been swept yet
  // Join with deposit_addresses to get derivation_index
  const { data: deposits, error } = await supabaseAdmin
    .from('deposits')
    .select('id, user_id, chain, asset, to_address, amount, status, sweep_status')
    .in('status', ['confirmed', 'credited'])
    .is('sweep_status', null)
    .eq('chain', 'ethereum');

  if (error) {
    return NextResponse.json({ error: 'Failed to load deposits' }, { status: 500 });
  }

  if (!deposits || deposits.length === 0) {
    return NextResponse.json({ ok: true, swept_count: 0, failed_count: 0, details: [] });
  }

  // Get unique addresses and their derivation indices
  const addresses = [...new Set(deposits.map((d) => d.to_address))];
  const { data: addrRows } = await supabaseAdmin
    .from('deposit_addresses')
    .select('address, derivation_index')
    .in('address', addresses);

  const indexMap = new Map<string, number>();
  for (const row of addrRows ?? []) {
    indexMap.set(row.address.toLowerCase(), row.derivation_index);
  }

  for (const deposit of deposits) {
    const derivationIndex = indexMap.get(deposit.to_address.toLowerCase());
    if (derivationIndex === undefined) {
      results.push({
        deposit_id: deposit.id,
        user_id: deposit.user_id,
        asset: deposit.asset,
        status: 'failed',
        error: 'No derivation index found',
      });
      failedCount++;
      continue;
    }

    // Mark as pending sweep
    await supabaseAdmin
      .from('deposits')
      .update({ sweep_status: 'pending' })
      .eq('id', deposit.id);

    try {
      const userWallet = deriveUserWallet(derivationIndex);

      if (deposit.asset === 'ETH') {
        const result = await sweepETH(userWallet, treasurerAddress);
        if (!result) {
          await supabaseAdmin
            .from('deposits')
            .update({ sweep_status: null })
            .eq('id', deposit.id);
          results.push({
            deposit_id: deposit.id,
            user_id: deposit.user_id,
            asset: 'ETH',
            status: 'skipped',
            error: 'Balance too low to cover gas',
          });
          continue;
        }

        await supabaseAdmin
          .from('deposits')
          .update({
            sweep_status: 'swept',
            sweep_tx_hash: result.hash,
          })
          .eq('id', deposit.id);

        results.push({
          deposit_id: deposit.id,
          user_id: deposit.user_id,
          asset: 'ETH',
          status: 'swept',
          sweep_tx: result.hash,
          amount: result.amount,
        });
        sweptCount++;
      } else if (deposit.asset === 'USDT') {
        // Check if user address has ETH for gas
        const ethBalance = await getETHBalance(userWallet.address);
        const ethBalanceNum = Number(ethBalance);

        // If ETH balance is too low, skip — admin must fund gas manually via wallets page
        if (ethBalanceNum < 0.002) {
          await supabaseAdmin
            .from('deposits')
            .update({ sweep_status: null })
            .eq('id', deposit.id);
          results.push({
            deposit_id: deposit.id,
            user_id: deposit.user_id,
            asset: 'USDT',
            status: 'skipped',
            error: 'Needs gas — fund ETH via admin wallets page',
          });
          continue;
        }

        // Check USDT balance and sweep
        const usdtBalance = await getUSDTBalance(userWallet.address);
        if (Number(usdtBalance) <= 0) {
          await supabaseAdmin
            .from('deposits')
            .update({ sweep_status: null })
            .eq('id', deposit.id);
          results.push({
            deposit_id: deposit.id,
            user_id: deposit.user_id,
            asset: 'USDT',
            status: 'skipped',
            error: 'Zero USDT balance on-chain',
          });
          continue;
        }

        const sweepResult = await sweepUSDT(userWallet, treasurerAddress);

        await supabaseAdmin
          .from('deposits')
          .update({
            sweep_status: 'swept',
            sweep_tx_hash: sweepResult.hash,
          })
          .eq('id', deposit.id);

        results.push({
          deposit_id: deposit.id,
          user_id: deposit.user_id,
          asset: 'USDT',
          status: 'swept',
          sweep_tx: sweepResult.hash,
          amount: sweepResult.amount,
        });
        sweptCount++;
      }
    } catch (err: any) {
      await supabaseAdmin
        .from('deposits')
        .update({ sweep_status: 'failed' })
        .eq('id', deposit.id);

      results.push({
        deposit_id: deposit.id,
        user_id: deposit.user_id,
        asset: deposit.asset,
        status: 'failed',
        error: err?.message ?? 'Unknown error',
      });
      failedCount++;
    }
  }

  return NextResponse.json({
    ok: true,
    swept_count: sweptCount,
    failed_count: failedCount,
    details: results,
  });
}
