import { NextResponse } from 'next/server';
import { formatEther, formatUnits, parseEther, parseUnits } from 'ethers';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export const runtime = 'nodejs';

const CRON_SECRET = process.env.CRON_SECRET;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY ?? '';
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_EVM_CHAIN_ID ?? '1');
const ETHERSCAN_BASE_URL =
  process.env.ETHERSCAN_BASE_URL ??
  (CHAIN_ID === 11155111 ? 'https://api-sepolia.etherscan.io' : 'https://api.etherscan.io');
const ERC20_USDT_CONTRACT = (process.env.NEXT_PUBLIC_EVM_USDT_CONTRACT ?? '').trim().toLowerCase();
const ERC20_USDT_DECIMALS = Number(process.env.DEPOSIT_USDT_DECIMALS ?? '6');

type CheckRequest = {
  asset?: string | null;
  tx_hash?: string | null;
  amount?: string | number | null;
  claimed_amount?: string | number | null;
};

function isAdmin(request: Request) {
  if (!ADMIN_TOKEN) return false;
  const header = request.headers.get('x-admin-token') ?? '';
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? '';
  return header === ADMIN_TOKEN || token === ADMIN_TOKEN;
}

function authOk(request: Request) {
  if (isAdmin(request)) return true;
  if (!CRON_SECRET) return true;
  const header = request.headers.get('x-cron-secret') ?? '';
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? '';
  return header === CRON_SECRET || token === CRON_SECRET;
}

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Etherscan request failed');
  return res.json();
}

async function fetchEthTxByHash(txHash: string) {
  const url = new URL(`${ETHERSCAN_BASE_URL}/api`);
  url.searchParams.set('module', 'proxy');
  url.searchParams.set('action', 'eth_getTransactionByHash');
  url.searchParams.set('txhash', txHash);
  if (ETHERSCAN_API_KEY) url.searchParams.set('apikey', ETHERSCAN_API_KEY);
  const data = await fetchJson(url.toString());
  return data?.result ?? null;
}

async function fetchEthReceipt(txHash: string) {
  const url = new URL(`${ETHERSCAN_BASE_URL}/api`);
  url.searchParams.set('module', 'proxy');
  url.searchParams.set('action', 'eth_getTransactionReceipt');
  url.searchParams.set('txhash', txHash);
  if (ETHERSCAN_API_KEY) url.searchParams.set('apikey', ETHERSCAN_API_KEY);
  const data = await fetchJson(url.toString());
  return data?.result ?? null;
}

async function fetchLatestBlockNumber() {
  const url = new URL(`${ETHERSCAN_BASE_URL}/api`);
  url.searchParams.set('module', 'proxy');
  url.searchParams.set('action', 'eth_blockNumber');
  if (ETHERSCAN_API_KEY) url.searchParams.set('apikey', ETHERSCAN_API_KEY);
  const data = await fetchJson(url.toString());
  return data?.result ?? null;
}

async function fetchTokenTransferByHash(txHash: string) {
  if (!ERC20_USDT_CONTRACT) return null;
  const url = new URL(`${ETHERSCAN_BASE_URL}/api`);
  url.searchParams.set('module', 'account');
  url.searchParams.set('action', 'tokentx');
  url.searchParams.set('txhash', txHash);
  if (ETHERSCAN_API_KEY) url.searchParams.set('apikey', ETHERSCAN_API_KEY);
  const data = await fetchJson(url.toString());
  if (data.status !== '1' || !Array.isArray(data.result)) return null;
  const match = data.result.find(
    (entry: any) => String(entry.contractAddress ?? '').toLowerCase() === ERC20_USDT_CONTRACT,
  );
  return match ?? null;
}

function wantsAsset(requested: string | null | undefined, asset: 'ETH' | 'USDT') {
  if (!requested) return true;
  return requested.toUpperCase() === asset;
}

function parseClaimedAmount(raw: string, asset: 'ETH' | 'USDT') {
  try {
    if (asset === 'ETH') return parseEther(raw);
    return parseUnits(raw, ERC20_USDT_DECIMALS);
  } catch {
    return null;
  }
}

async function creditBalanceIfNeeded(params: {
  user_id: string;
  asset: string;
  amount: string;
  tx_hash: string;
}) {
  const { user_id, asset, amount, tx_hash } = params;
  const accountType = 'funding';

  const { data: existingLedger } = await supabaseAdmin
    .from('ledger_entries')
    .select('id')
    .eq('user_id', user_id)
    .eq('asset', asset)
    .eq('reference_type', 'deposit')
    .eq('reference_id', tx_hash)
    .limit(1)
    .maybeSingle();

  if (existingLedger?.id) {
    return { credited: true, skipped: true };
  }

  const { data: balanceRow } = await supabaseAdmin
    .from('balances')
    .select('available, locked')
    .eq('user_id', user_id)
    .eq('asset', asset)
    .eq('account_type', accountType)
    .maybeSingle();

  const currentAvailable = Number(balanceRow?.available ?? 0);
  const currentLocked = Number(balanceRow?.locked ?? 0);
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount)) {
    return { credited: false, error: 'Invalid amount for balance update' };
  }

  const { error: balanceError } = await supabaseAdmin.from('balances').upsert(
    {
      user_id,
      asset,
      account_type: accountType,
      available: currentAvailable + numericAmount,
      locked: currentLocked,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,asset,account_type' },
  );

  if (balanceError) {
    return { credited: false, error: 'Failed to update balance' };
  }

  const { error: ledgerError } = await supabaseAdmin.from('ledger_entries').insert({
    user_id,
    asset,
    amount: numericAmount,
    entry_type: 'credit',
    reference_type: 'deposit',
    reference_id: tx_hash,
    metadata: { source: 'onchain', account_type: accountType },
  });

  if (ledgerError) {
    return { credited: false, error: 'Failed to write ledger entry' };
  }

  return { credited: true, skipped: false };
}

export async function POST(request: Request) {
  if (!authOk(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: CheckRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const admin = isAdmin(request);
  const txHash = String(body?.tx_hash ?? '').trim().toLowerCase();
  if (!txHash) {
    return NextResponse.json({ error: 'Missing tx_hash' }, { status: 400 });
  }

  const asset = body?.asset ? String(body.asset).trim().toUpperCase() : null;
  const claimedRaw = body?.claimed_amount ?? body?.amount ?? null;
  const claimedAmount = claimedRaw === null ? null : String(claimedRaw).trim();

  let matchedAsset: 'ETH' | 'USDT' | null = null;
  let toAddress = '';
  let fromAddress = '';
  let amountOnchain = '';
  let confirmations = 0;
  let status: 'pending' | 'detected' | 'confirmed' = 'pending';
  let metadata: Record<string, any> = {};

  let tokenTx: any = null;
  if (wantsAsset(asset, 'USDT')) {
    tokenTx = await fetchTokenTransferByHash(txHash);
  }

  if (tokenTx && wantsAsset(asset, 'USDT')) {
    matchedAsset = 'USDT';
    toAddress = String(tokenTx.to ?? '').toLowerCase();
    fromAddress = String(tokenTx.from ?? '').toLowerCase();
    amountOnchain = formatUnits(BigInt(tokenTx.value), ERC20_USDT_DECIMALS);
    confirmations = Number(tokenTx.confirmations ?? 0);
    status = confirmations >= 12 ? 'confirmed' : confirmations > 0 ? 'detected' : 'pending';
    metadata = {
      blockNumber: tokenTx.blockNumber,
      contract: tokenTx.contractAddress,
    };
  } else if (wantsAsset(asset, 'ETH')) {
    const ethTx = await fetchEthTxByHash(txHash);
    if (!ethTx) {
      return NextResponse.json({ error: 'Transaction not found on-chain' }, { status: 404 });
    }

    if (!ethTx.to || !ethTx.value || ethTx.value === '0x0') {
      return NextResponse.json({ error: 'Transaction has no ETH value' }, { status: 400 });
    }

    matchedAsset = 'ETH';
    toAddress = String(ethTx.to ?? '').toLowerCase();
    fromAddress = String(ethTx.from ?? '').toLowerCase();
    amountOnchain = formatEther(BigInt(ethTx.value));

    const receipt = await fetchEthReceipt(txHash);
    const latestBlockHex = await fetchLatestBlockNumber();
    if (receipt?.blockNumber && latestBlockHex) {
      const latest = BigInt(latestBlockHex);
      const blockNum = BigInt(receipt.blockNumber);
      if (latest >= blockNum) {
        confirmations = Number(latest - blockNum + 1n);
      }
      metadata = {
        blockNumber: receipt.blockNumber,
        status: receipt.status,
      };
    }

    status = confirmations >= 12 ? 'confirmed' : confirmations > 0 ? 'detected' : 'pending';
  } else {
    return NextResponse.json({ error: 'Transaction does not match requested asset' }, { status: 400 });
  }

  if (!toAddress) {
    return NextResponse.json({ error: 'Missing to_address on transaction' }, { status: 400 });
  }

  const { data: owner, error: ownerError } = await supabaseAdmin
    .from('deposit_addresses')
    .select('user_id, address')
    .eq('chain', 'ethereum')
    .ilike('address', toAddress)
    .maybeSingle();

  if (ownerError) {
    return NextResponse.json({ error: 'Failed to lookup address owner' }, { status: 500 });
  }
  if (!owner?.user_id) {
    return NextResponse.json({ error: 'Address not found for any user' }, { status: 404 });
  }

  const claimedUnits =
    claimedAmount && matchedAsset ? parseClaimedAmount(claimedAmount, matchedAsset) : null;
  const onchainUnits = matchedAsset === 'USDT'
    ? parseUnits(amountOnchain, ERC20_USDT_DECIMALS)
    : parseEther(amountOnchain);
  const mismatch = claimedUnits !== null ? claimedUnits !== onchainUnits : false;

  const { error: upsertError } = await supabaseAdmin.from('deposits').upsert(
    {
      user_id: owner.user_id,
      chain: 'ethereum',
      asset: matchedAsset,
      to_address: toAddress,
      from_address: fromAddress || null,
      tx_hash: txHash,
      amount: amountOnchain,
      status,
      confirmations,
      metadata: {
        ...metadata,
        ...(claimedAmount ? { claimed_amount: claimedAmount, mismatch } : {}),
      },
      detected_at: status !== 'pending' ? new Date().toISOString() : null,
      confirmed_at: status === 'confirmed' ? new Date().toISOString() : null,
    },
    { onConflict: 'chain,tx_hash' },
  );

  if (upsertError) {
    return NextResponse.json({ error: 'Failed to upsert deposit' }, { status: 500 });
  }

  let credited = false;
  let creditError: string | null = null;
  if (status === 'confirmed') {
    const { data: existingDeposit } = await supabaseAdmin
      .from('deposits')
      .select('credited_at')
      .eq('chain', 'ethereum')
      .eq('tx_hash', txHash)
      .maybeSingle();

    if (!existingDeposit?.credited_at) {
      const creditResult = await creditBalanceIfNeeded({
        user_id: owner.user_id,
        asset: matchedAsset,
        amount: amountOnchain,
        tx_hash: txHash,
      });
      credited = creditResult.credited;
      if (!creditResult.credited && creditResult.error) {
        creditError = creditResult.error;
      }

      if (creditResult.credited) {
        await supabaseAdmin
          .from('deposits')
          .update({ status: 'credited', credited_at: new Date().toISOString() })
          .eq('chain', 'ethereum')
          .eq('tx_hash', txHash)
          .is('credited_at', null);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    asset: matchedAsset,
    to_address: toAddress,
    amount_onchain: amountOnchain,
    amount_claimed: claimedAmount,
    mismatch,
    status,
    confirmations,
    credited,
    credit_error: creditError,
    user_id: admin ? owner.user_id : undefined,
  });
}
