import { NextResponse } from 'next/server';
import { formatEther, formatUnits } from 'ethers';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export const runtime = 'nodejs';

const CRON_SECRET = process.env.CRON_SECRET;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY ?? '';
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_EVM_CHAIN_ID ?? '1');
const ETHERSCAN_BASE_URL =
  process.env.ETHERSCAN_BASE_URL ??
  (CHAIN_ID === 11155111 ? 'https://api-sepolia.etherscan.io' : 'https://api.etherscan.io');
const ERC20_USDT_CONTRACT = (process.env.NEXT_PUBLIC_EVM_USDT_CONTRACT ?? '').trim().toLowerCase();
const ERC20_USDT_DECIMALS = Number(process.env.DEPOSIT_USDT_DECIMALS ?? '6');

function authOk(request: Request) {
  if (!CRON_SECRET) return true;
  const header = request.headers.get('x-cron-secret') ?? '';
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? '';
  return header === CRON_SECRET || token === CRON_SECRET;
}

async function fetchTransactions(address: string) {
  const url = new URL(`${ETHERSCAN_BASE_URL}/api`);
  url.searchParams.set('module', 'account');
  url.searchParams.set('action', 'txlist');
  url.searchParams.set('address', address);
  url.searchParams.set('startblock', '0');
  url.searchParams.set('endblock', '99999999');
  url.searchParams.set('sort', 'asc');
  if (ETHERSCAN_API_KEY) url.searchParams.set('apikey', ETHERSCAN_API_KEY);

  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) throw new Error('Etherscan request failed');
  const data = await res.json();
  if (data.status !== '1' || !Array.isArray(data.result)) return [];
  return data.result as Array<any>;
}

async function fetchTokenTransfers(address: string) {
  if (!ERC20_USDT_CONTRACT) return [];
  const url = new URL(`${ETHERSCAN_BASE_URL}/api`);
  url.searchParams.set('module', 'account');
  url.searchParams.set('action', 'tokentx');
  url.searchParams.set('address', address);
  url.searchParams.set('startblock', '0');
  url.searchParams.set('endblock', '99999999');
  url.searchParams.set('sort', 'asc');
  if (ETHERSCAN_API_KEY) url.searchParams.set('apikey', ETHERSCAN_API_KEY);

  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) throw new Error('Etherscan token request failed');
  const data = await res.json();
  if (data.status !== '1' || !Array.isArray(data.result)) return [];
  return data.result as Array<any>;
}

export async function POST(request: Request) {
  if (!authOk(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: addresses, error } = await supabaseAdmin
    .from('deposit_addresses')
    .select('user_id, address, chain, asset')
    .eq('chain', 'ethereum')
    .eq('asset', 'ETH');

  if (error) {
    return NextResponse.json({ error: 'Failed to load addresses' }, { status: 500 });
  }

  let scanned = 0;
  let inserted = 0;

  for (const entry of addresses ?? []) {
    const address = String(entry.address).toLowerCase();
    const txs = await fetchTransactions(address);
    const tokenTxs = await fetchTokenTransfers(address);
    scanned += txs.length + tokenTxs.length;

    for (const tx of txs) {
      if (!tx?.to || String(tx.to).toLowerCase() !== address) continue;
      if (tx.isError && tx.isError !== '0') continue;
      if (!tx.hash || !tx.value) continue;
      if (tx.value === '0') continue;

      const confirmations = Number(tx.confirmations ?? 0);
      const status = confirmations >= 12 ? 'confirmed' : confirmations > 0 ? 'detected' : 'pending';
      const detectedAt = tx.timeStamp ? new Date(Number(tx.timeStamp) * 1000).toISOString() : null;
      const confirmedAt = confirmations >= 12 ? new Date(Number(tx.timeStamp) * 1000).toISOString() : null;

      const { error: upsertError } = await supabaseAdmin.from('deposits').upsert(
        {
          user_id: entry.user_id,
          chain: 'ethereum',
          asset: 'ETH',
          to_address: entry.address,
          from_address: tx.from,
          tx_hash: tx.hash,
          amount: formatEther(BigInt(tx.value)),
          status,
          confirmations,
          metadata: {
            blockNumber: tx.blockNumber,
          },
          detected_at: detectedAt,
          confirmed_at: confirmedAt,
        },
        { onConflict: 'chain,tx_hash' },
      );

      if (!upsertError) inserted += 1;
    }

    for (const tx of tokenTxs) {
      if (!tx?.to || String(tx.to).toLowerCase() !== address) continue;
      if (tx.isError && tx.isError !== '0') continue;
      if (!tx.hash || !tx.value) continue;
      if (tx.value === '0') continue;
      if (String(tx.contractAddress ?? '').toLowerCase() !== ERC20_USDT_CONTRACT) continue;

      const confirmations = Number(tx.confirmations ?? 0);
      const status = confirmations >= 12 ? 'confirmed' : confirmations > 0 ? 'detected' : 'pending';
      const detectedAt = tx.timeStamp ? new Date(Number(tx.timeStamp) * 1000).toISOString() : null;
      const confirmedAt = confirmations >= 12 ? new Date(Number(tx.timeStamp) * 1000).toISOString() : null;

      const { error: upsertError } = await supabaseAdmin.from('deposits').upsert(
        {
          user_id: entry.user_id,
          chain: 'ethereum',
          asset: 'USDT',
          to_address: entry.address,
          from_address: tx.from,
          tx_hash: tx.hash,
          amount: formatUnits(BigInt(tx.value), ERC20_USDT_DECIMALS),
          status,
          confirmations,
          metadata: {
            blockNumber: tx.blockNumber,
            contract: tx.contractAddress,
          },
          detected_at: detectedAt,
          confirmed_at: confirmedAt,
        },
        { onConflict: 'chain,tx_hash' },
      );

      if (!upsertError) inserted += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    addresses: addresses?.length ?? 0,
    scanned,
    inserted,
  });
}
