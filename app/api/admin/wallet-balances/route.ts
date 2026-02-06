import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  getETHBalance,
  getUSDTBalance,
  getTreasurerAddress,
} from '@/lib/blockchain/ethereum';

export const runtime = 'nodejs';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

function isAuthorized(request: Request) {
  if (!ADMIN_TOKEN) return false;
  const header = request.headers.get('x-admin-token') ?? '';
  const cookie = request.headers.get('cookie')?.match(/admin_auth=([^;]+)/)?.[1] ?? '';
  return header === ADMIN_TOKEN || cookie === ADMIN_TOKEN;
}

const CONCURRENCY = 5;

async function batchQuery<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch all Ethereum deposit addresses
    const { data: addresses, error } = await supabaseAdmin
      .from('deposit_addresses')
      .select('user_id, address, chain, asset')
      .eq('chain', 'ethereum');

    if (error) {
      return NextResponse.json({ error: 'Failed to load addresses' }, { status: 500 });
    }

    // Query treasurer balances
    const treasurerAddress = getTreasurerAddress();
    const [treasurerEth, treasurerUsdt] = await Promise.all([
      getETHBalance(treasurerAddress),
      getUSDTBalance(treasurerAddress),
    ]);

    // Deduplicate addresses (a user may have one address for both ETH and USDT)
    const uniqueAddresses = new Map<string, { user_id: string; address: string }>();
    for (const entry of addresses ?? []) {
      const key = entry.address.toLowerCase();
      if (!uniqueAddresses.has(key)) {
        uniqueAddresses.set(key, { user_id: entry.user_id, address: entry.address });
      }
    }

    const addrList = Array.from(uniqueAddresses.values());

    // Query on-chain balances with concurrency limit
    const userWallets = await batchQuery(
      addrList,
      async (entry) => {
        const [ethBal, usdtBal] = await Promise.all([
          getETHBalance(entry.address).catch(() => '0'),
          getUSDTBalance(entry.address).catch(() => '0'),
        ]);
        return {
          user_id: entry.user_id,
          address: entry.address,
          eth_balance: ethBal,
          usdt_balance: usdtBal,
          needs_gas: Number(usdtBal) > 0 && Number(ethBal) < 0.001,
        };
      },
      CONCURRENCY,
    );

    // Compute totals
    let totalEth = Number(treasurerEth);
    let totalUsdt = Number(treasurerUsdt);
    for (const w of userWallets) {
      totalEth += Number(w.eth_balance);
      totalUsdt += Number(w.usdt_balance);
    }

    return NextResponse.json({
      treasurer: {
        address: treasurerAddress,
        eth_balance: treasurerEth,
        usdt_balance: treasurerUsdt,
      },
      user_wallets: userWallets,
      total_eth: totalEth.toString(),
      total_usdt: totalUsdt.toString(),
    });
  } catch (err: any) {
    console.error('Wallet balances error:', err);
    return NextResponse.json({ error: err?.message ?? 'Failed to fetch balances' }, { status: 500 });
  }
}
