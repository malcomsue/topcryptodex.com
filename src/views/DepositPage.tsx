'use client';

import { useEffect, useMemo, useState } from 'react';
import { Copy } from 'lucide-react';
import { useConnectWallet, usePrivy, useWallets } from '@privy-io/react-auth';

type DepositAsset = 'USDT' | 'BTC' | 'XRP';
type DepositNetwork = 'ethereum' | 'tron' | 'bitcoin' | 'btc_segwit' | 'btc_lightning' | 'xrp';

const PLATFORM_ADDRESSES = {
  // Support both names to reduce env config confusion.
  TRON: process.env.NEXT_PUBLIC_DEPOSIT_TRON_ADDRESS ?? process.env.NEXT_PUBLIC_DEPOSIT_USDT_TRON_ADDRESS,
  BTC: process.env.NEXT_PUBLIC_DEPOSIT_BTC_ADDRESS,
  BTC_LEGACY: process.env.NEXT_PUBLIC_DEPOSIT_BTC_LEGACY_ADDRESS,
  BTC_LIGHTNING: process.env.NEXT_PUBLIC_DEPOSIT_BTC_LIGHTNING_ADDRESS,
  XRP: process.env.NEXT_PUBLIC_DEPOSIT_XRP_ADDRESS,
} as const;

const XRP_DESTINATION_TAG = process.env.NEXT_PUBLIC_DEPOSIT_XRP_DESTINATION_TAG;
const XRP_REQUIRE_DESTINATION_TAG =
  (process.env.NEXT_PUBLIC_XRP_REQUIRE_DESTINATION_TAG ?? 'true').trim().toLowerCase() !== 'false';

const EVM_CHAIN_ID = Number(process.env.NEXT_PUBLIC_EVM_CHAIN_ID ?? '11155111'); // default Sepolia for testing
const EVM_CHAIN_ID_HEX = `0x${EVM_CHAIN_ID.toString(16)}`;
const EVM_USDT_CONTRACT = (process.env.NEXT_PUBLIC_EVM_USDT_CONTRACT ?? '').trim();

const TRON_NETWORK = (process.env.NEXT_PUBLIC_TRON_NETWORK ?? 'mainnet').trim().toLowerCase();
const TRON_USDT_CONTRACT = (process.env.NEXT_PUBLIC_TRON_USDT_CONTRACT ?? '').trim();

const ERC20_APPROVE_SELECTOR = '0x095ea7b3';
const ERC20_TRANSFER_SELECTOR = '0xa9059cbb';

const COIN_LABELS: Record<DepositAsset, string> = {
  USDT: 'TetherUS',
  BTC: 'Bitcoin',
  XRP: 'Ripple',
};

function stripHexPrefix(value: string) {
  return value.startsWith('0x') ? value.slice(2) : value;
}

function pad32(hexNoPrefix: string) {
  return hexNoPrefix.padStart(64, '0');
}

function encodeAddress(address: string) {
  return pad32(stripHexPrefix(address).toLowerCase());
}

function encodeUint256(value: bigint) {
  return pad32(value.toString(16));
}

function parseUnits(input: string, decimals: number) {
  const trimmed = input.trim();
  if (!trimmed) return 0n;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error('Invalid amount');

  const [whole, fraction = ''] = trimmed.split('.');
  const fractionPadded = (fraction + '0'.repeat(decimals)).slice(0, decimals);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fractionPadded);
}

export default function DepositPage() {
  const { authenticated, ready, login, user } = usePrivy();
  const { connectWallet } = useConnectWallet();
  const { wallets } = useWallets();
  const [activeAsset, setActiveAsset] = useState<DepositAsset>('USDT');
  const [selectedNetwork, setSelectedNetwork] = useState<DepositNetwork>('ethereum');
  const [copied, setCopied] = useState(false);
  const [usdtAmount, setUsdtAmount] = useState('');
  const [userEthAddress, setUserEthAddress] = useState<string | null>(null);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState('');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [tronAmount, setTronAmount] = useState('');
  const [tronLoading, setTronLoading] = useState(false);
  const [tronError, setTronError] = useState('');
  const [tronTxId, setTronTxId] = useState<string | null>(null);
  const [tronConnectedAddress, setTronConnectedAddress] = useState<string | null>(null);
  const [btcAmount, setBtcAmount] = useState('');
  const [btcCopied, setBtcCopied] = useState(false);
  const [xrpMemo, setXrpMemo] = useState('');
  const [xrpMemoCopied, setXrpMemoCopied] = useState(false);
  const [xrpDestinationTag, setXrpDestinationTag] = useState<string | null>(null);
  const [xrpTagError, setXrpTagError] = useState<string | null>(null);
  const [xrpTagLoading, setXrpTagLoading] = useState(false);

  const depositAddress = useMemo(() => {
    if (activeAsset === 'USDT') {
      if (selectedNetwork === 'ethereum') return userEthAddress;
      if (selectedNetwork === 'tron') return PLATFORM_ADDRESSES.TRON ?? null;
      return null;
    }
    if (activeAsset === 'BTC') {
      if (selectedNetwork === 'btc_segwit') return PLATFORM_ADDRESSES.BTC ?? null;
      if (selectedNetwork === 'bitcoin') return PLATFORM_ADDRESSES.BTC_LEGACY ?? null;
      if (selectedNetwork === 'btc_lightning') return PLATFORM_ADDRESSES.BTC_LIGHTNING ?? null;
      return PLATFORM_ADDRESSES.BTC ?? null;
    }
    if (activeAsset === 'XRP') return PLATFORM_ADDRESSES.XRP ?? null;
    return null;
  }, [activeAsset, selectedNetwork, userEthAddress]);

  const connectedEvmWallet = useMemo(() => {
    return wallets.find((wallet: any) => wallet?.chainType === 'ethereum' || wallet?.address);
  }, [wallets]);

  const connectedEvmAddress = (connectedEvmWallet as any)?.address as string | undefined;

  const depositNetworkLabel = useMemo(() => {
    if (activeAsset === 'USDT') {
      if (selectedNetwork === 'ethereum') {
        return EVM_CHAIN_ID === 11155111 ? 'Sepolia Testnet (ERC20)' : 'Ethereum Mainnet (ERC20)';
      }
      return 'TRON Network (TRC20)';
    }
    if (activeAsset === 'BTC') {
      if (selectedNetwork === 'btc_segwit') return 'BTC (SegWit)';
      if (selectedNetwork === 'bitcoin') return 'Bitcoin';
      if (selectedNetwork === 'btc_lightning') return 'Lightning Network';
      return 'Bitcoin';
    }
    return 'XRP Ledger';
  }, [activeAsset, selectedNetwork]);

  const networkOptions = useMemo(() => {
    if (activeAsset === 'USDT') {
      return [
        {
          id: 'ethereum',
          label: EVM_CHAIN_ID === 11155111 ? 'Sepolia Testnet (ERC20)' : 'Ethereum Mainnet (ERC20)',
        },
        {
          id: 'tron',
          label: 'TRON Network (TRC20)',
        },
      ];
    }
    if (activeAsset === 'BTC') {
      return [
        {
          id: 'btc_segwit',
          label: 'SEGWITBTC (BTC SegWit)',
        },
        {
          id: 'bitcoin',
          label: 'BTC (Bitcoin)',
        },
        {
          id: 'btc_lightning',
          label: 'LIGHTNING (Lightning Network)',
        },
      ];
    }
    return [
      {
        id: 'xrp',
        label: 'XRP Ledger',
      },
    ];
  }, [activeAsset]);

  useEffect(() => {
    if (!networkOptions.length) return;
    setSelectedNetwork(networkOptions[0].id as DepositNetwork);
  }, [networkOptions]);

  useEffect(() => {
    const userId = (user as any)?.id as string | undefined;
    if (!authenticated || !userId) return;

    let cancelled = false;
    async function loadAddress() {
      try {
        const res = await fetch('/api/deposits/address', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, chain: 'ethereum', asset: 'USDT' }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.address) setUserEthAddress(String(data.address));
      } catch {
        // ignore
      }
    }

    loadAddress();
    return () => {
      cancelled = true;
    };
  }, [authenticated, user]);

  useEffect(() => {
    if (activeAsset !== 'XRP') return;
    const userId = (user as any)?.id as string | undefined;
    if (!authenticated || !userId) return;

    let cancelled = false;
    async function loadXrpTag() {
      setXrpTagError(null);
      setXrpTagLoading(true);
      try {
        const res = await fetch('/api/deposits/xrp-tag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || 'Failed to fetch destination tag');
        }
        const data = await res.json();
        if (!cancelled && data?.tag) setXrpDestinationTag(String(data.tag));
      } catch (err: any) {
        if (!cancelled) setXrpTagError(err?.message ?? 'Unable to fetch destination tag');
      } finally {
        if (!cancelled) setXrpTagLoading(false);
      }
    }
    loadXrpTag();
    return () => {
      cancelled = true;
    };
  }, [activeAsset, authenticated, user]);

  const btcPaymentUri = useMemo(() => {
    if (activeAsset !== 'BTC') return null;
    if (selectedNetwork === 'btc_lightning') return null;
    const addr = depositAddress ?? '';
    if (!addr) return null;

    const amt = btcAmount.trim();
    if (!amt) return `bitcoin:${addr}`;
    if (!/^\d+(\.\d+)?$/.test(amt)) return `bitcoin:${addr}`;

    const [whole, frac = ''] = amt.split('.');
    if (frac.length > 8) return `bitcoin:${addr}`;
    return `bitcoin:${addr}?amount=${whole}${frac ? `.${frac}` : ''}`;
  }, [activeAsset, btcAmount, depositAddress, selectedNetwork]);

  const handleCopy = async () => {
    if (!depositAddress) return;
    try {
      await navigator.clipboard.writeText(depositAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  const handleCopyBtcUri = async () => {
    if (!btcPaymentUri) return;
    try {
      await navigator.clipboard.writeText(btcPaymentUri);
      setBtcCopied(true);
      window.setTimeout(() => setBtcCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  const handleCopyXrpMemo = async () => {
    if (!xrpMemo) return;
    try {
      await navigator.clipboard.writeText(xrpMemo);
      setXrpMemoCopied(true);
      window.setTimeout(() => setXrpMemoCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  const getEthereumProvider = async () => {
    const wallet = wallets.find((w) => typeof (w as any).getEthereumProvider === 'function');
    if (wallet && (wallet as any).getEthereumProvider) return (wallet as any).getEthereumProvider();
    const eth = (window as any).ethereum;
    if (!eth) throw new Error('No Ethereum wallet detected');
    return eth;
  };

  const requireMainnet = async (provider: any) => {
    const chainId = await provider.request({ method: 'eth_chainId' });
    if (String(chainId).toLowerCase() !== EVM_CHAIN_ID_HEX) {
      const targetName = EVM_CHAIN_ID === 11155111 ? 'Sepolia' : 'Ethereum Mainnet';
      throw new Error(`Please switch to ${targetName}`);
    }
  };

  const getFromAddress = async (provider: any) => {
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    const from = Array.isArray(accounts) ? accounts[0] : null;
    if (!from) throw new Error('No wallet account selected');
    return from;
  };

  const sendEvmTx = async (provider: any, tx: { from: string; to: string; data: string; value?: string }) => {
    const hash = await provider.request({
      method: 'eth_sendTransaction',
      params: [{ ...tx, value: tx.value ?? '0x0' }],
    });
    return String(hash);
  };

  const recordDepositIntent = async (intent: {
    chain: 'evm' | 'tron' | 'bitcoin' | 'xrp';
    asset: string;
    to_address: string;
    from_address?: string | null;
    tx_hash?: string | null;
    amount?: string | null;
    destination_tag?: string | null;
    metadata?: Record<string, unknown>;
  }) => {
    try {
      await fetch('/api/deposits/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...intent,
          user_id: (user as any)?.id ?? null,
        }),
      });
    } catch {
      // Ignore; deposit can still be tracked later by polling/manual support.
    }
  };

  const getTron = () => {
    const anyWindow = window as any;
    return {
      tronWeb: anyWindow?.tronWeb,
      tronLink: anyWindow?.tronLink,
    };
  };

  const tronExplorerBase = () => {
    if (TRON_NETWORK === 'nile') return 'https://nile.tronscan.org';
    if (TRON_NETWORK === 'shasta') return 'https://shasta.tronscan.org';
    return 'https://tronscan.org';
  };

  const connectTronLink = async () => {
    setTronError('');
    setTronTxId(null);
    setTronLoading(true);
    try {
      const { tronLink, tronWeb } = getTron();
      if (!tronLink && !tronWeb) throw new Error('TronLink not detected');

      if (tronLink?.request) {
        await tronLink.request({ method: 'tron_requestAccounts' });
      } else if (tronWeb?.request) {
        await tronWeb.request({ method: 'tron_requestAccounts' });
      }

      const updated = getTron().tronWeb;
      const addr =
        updated?.defaultAddress?.base58 ??
        updated?.defaultAddress?.hex ??
        null;
      if (!addr) throw new Error('Unable to read TronLink address');
      setTronConnectedAddress(String(addr));
    } catch (e: any) {
      setTronError(e?.message ?? 'Unable to connect TronLink');
    } finally {
      setTronLoading(false);
    }
  };

  const sendTronUsdt = async () => {
    if (!depositAddress) return;
    setTronError('');
    setTronTxId(null);
    setTronLoading(true);
    try {
      if (!TRON_USDT_CONTRACT) throw new Error('Missing TRON token contract. Set NEXT_PUBLIC_TRON_USDT_CONTRACT.');
      const { tronWeb } = getTron();
      if (!tronWeb) throw new Error('TronLink not detected');

      const amount = parseUnits(tronAmount, 6);
      if (amount <= 0n) throw new Error('Enter an amount');

      const addr = tronWeb?.defaultAddress?.base58;
      if (!addr) throw new Error('Connect TronLink first');
      setTronConnectedAddress(String(addr));

      // Basic network sanity check (best-effort; TronLink network APIs vary).
      const host: string | undefined = tronWeb?.fullNode?.host;
      if (TRON_NETWORK === 'nile' && host && !host.toLowerCase().includes('nile')) {
        throw new Error('Please switch TronLink to Nile testnet');
      }
      if (TRON_NETWORK === 'shasta' && host && !host.toLowerCase().includes('shasta')) {
        throw new Error('Please switch TronLink to Shasta testnet');
      }

      const contract = await tronWeb.contract().at(TRON_USDT_CONTRACT);
      const tx = await contract.transfer(depositAddress, amount.toString()).send();
      setTronTxId(String(tx));
      void recordDepositIntent({
        chain: 'tron',
        asset: 'USDT',
        to_address: depositAddress,
        from_address: tronWeb?.defaultAddress?.base58 ?? null,
        tx_hash: String(tx),
        amount: tronAmount.trim() || null,
        metadata: { network: TRON_NETWORK, token_contract: TRON_USDT_CONTRACT },
      });
    } catch (e: any) {
      setTronError(e?.message ?? 'TRON transfer failed');
    } finally {
      setTronLoading(false);
    }
  };

  const handleSwitchNetwork = async () => {
    setTxError('');
    setTxHash(null);
    setTxLoading(true);
    try {
      const provider = await getEthereumProvider();
      const targetName = EVM_CHAIN_ID === 11155111 ? 'Sepolia' : 'Ethereum Mainnet';

      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: EVM_CHAIN_ID_HEX }],
        });
      } catch (switchError: any) {
        // 4902 = chain not added to wallet
        if (switchError?.code === 4902) {
          const addParams =
            EVM_CHAIN_ID === 11155111
              ? {
                  chainId: EVM_CHAIN_ID_HEX,
                  chainName: 'Sepolia',
                  nativeCurrency: { name: 'SepoliaETH', symbol: 'SEP', decimals: 18 },
                  rpcUrls: ['https://rpc.sepolia.org'],
                  blockExplorerUrls: ['https://sepolia.etherscan.io'],
                }
              : {
                  chainId: EVM_CHAIN_ID_HEX,
                  chainName: 'Ethereum Mainnet',
                  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                  rpcUrls: ['https://cloudflare-eth.com'],
                  blockExplorerUrls: ['https://etherscan.io'],
                };

          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [addParams],
          });

          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: EVM_CHAIN_ID_HEX }],
          });
        } else {
          throw switchError;
        }
      }

      const chainId = await provider.request({ method: 'eth_chainId' });
      if (String(chainId).toLowerCase() !== EVM_CHAIN_ID_HEX) {
        throw new Error(`Network switch failed. Please switch to ${targetName}.`);
      }
    } catch (e: any) {
      setTxError(e?.message ?? 'Unable to switch network');
    } finally {
      setTxLoading(false);
    }
  };

  const handleUsdtApprove = async () => {
    if (!depositAddress) return;
    setTxError('');
    setTxHash(null);
    setTxLoading(true);
    try {
      if (!EVM_USDT_CONTRACT) throw new Error('Missing token contract. Set NEXT_PUBLIC_EVM_USDT_CONTRACT.');
      const amount = parseUnits(usdtAmount, 6);
      if (amount <= 0n) throw new Error('Enter an amount');
      const provider = await getEthereumProvider();
      await requireMainnet(provider);
      const from = await getFromAddress(provider);

      const data =
        ERC20_APPROVE_SELECTOR + encodeAddress(depositAddress) + encodeUint256(amount);

      const hash = await sendEvmTx(provider, {
        from,
        to: EVM_USDT_CONTRACT,
        data,
      });
      setTxHash(hash);
      void recordDepositIntent({
        chain: 'evm',
        asset: 'USDT',
        to_address: depositAddress,
        from_address: from,
        tx_hash: hash,
        amount: usdtAmount.trim() || null,
        metadata: { chain_id: EVM_CHAIN_ID, token_contract: EVM_USDT_CONTRACT, action: 'approve' },
      });
    } catch (e: any) {
      setTxError(e?.message ?? 'Approval failed');
    } finally {
      setTxLoading(false);
    }
  };

  const handleUsdtTransfer = async () => {
    if (!depositAddress) return;
    setTxError('');
    setTxHash(null);
    setTxLoading(true);
    try {
      if (!EVM_USDT_CONTRACT) throw new Error('Missing token contract. Set NEXT_PUBLIC_EVM_USDT_CONTRACT.');
      const amount = parseUnits(usdtAmount, 6);
      if (amount <= 0n) throw new Error('Enter an amount');
      const provider = await getEthereumProvider();
      await requireMainnet(provider);
      const from = await getFromAddress(provider);

      const data =
        ERC20_TRANSFER_SELECTOR + encodeAddress(depositAddress) + encodeUint256(amount);

      const hash = await sendEvmTx(provider, {
        from,
        to: EVM_USDT_CONTRACT,
        data,
      });
      setTxHash(hash);
      void recordDepositIntent({
        chain: 'evm',
        asset: 'USDT',
        to_address: depositAddress,
        from_address: from,
        tx_hash: hash,
        amount: usdtAmount.trim() || null,
        metadata: { chain_id: EVM_CHAIN_ID, token_contract: EVM_USDT_CONTRACT, action: 'transfer' },
      });
    } catch (e: any) {
      setTxError(e?.message ?? 'Transfer failed');
    } finally {
      setTxLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
          <p className="text-gray-700">Loading…</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
          <h1 className="text-3xl font-semibold text-gray-900">Deposit Funds</h1>
          <p className="text-gray-600 mt-2">
            Log in to generate your deposit instructions and funding address.
          </p>
          <button
            onClick={login}
            className="mt-6 px-6 py-3 rounded-full bg-black text-white font-medium hover:opacity-90 transition"
          >
            Continue with Privy
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1115] text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Deposit</h1>
            <p className="text-sm text-white/60 mt-1">Choose token, pick a network, and copy your deposit address.</p>
          </div>
          <button className="text-xs text-white/60 hover:text-white">Manage</button>
        </div>

        <div className="bg-[#151820] border border-white/10 rounded-2xl p-6 space-y-6">
          <div className="flex items-start gap-4">
            <div className="h-7 w-7 rounded-full bg-white/10 text-xs font-semibold flex items-center justify-center">1</div>
            <div className="flex-1 space-y-3">
              <p className="text-sm font-semibold">Select Coin</p>
              <div className="relative">
                <select
                  value={activeAsset}
                  onChange={(e) => setActiveAsset(e.target.value as DepositAsset)}
                  className="w-full appearance-none rounded-xl border border-white/10 bg-[#0f1115] px-4 py-3 text-sm"
                >
                  {(['USDT', 'BTC', 'XRP'] as DepositAsset[]).map((asset) => (
                    <option key={asset} value={asset}>
                      {asset} - {COIN_LABELS[asset]}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/40">▼</span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="h-7 w-7 rounded-full bg-white/10 text-xs font-semibold flex items-center justify-center">2</div>
            <div className="flex-1 space-y-3">
              <p className="text-sm font-semibold">Select Network</p>
              <div className="relative">
                <select
                  value={selectedNetwork}
                  onChange={(e) => setSelectedNetwork(e.target.value as DepositNetwork)}
                  className="w-full appearance-none rounded-xl border border-white/10 bg-[#0f1115] px-4 py-3 text-sm"
                >
                  {networkOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/40">▼</span>
              </div>
              {activeAsset === 'USDT' && selectedNetwork === 'ethereum' && EVM_USDT_CONTRACT && (
                <div className="text-xs text-white/50">
                  Contract address ending in{' '}
                  <span className="text-white">{EVM_USDT_CONTRACT.slice(-5).toUpperCase()}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="h-7 w-7 rounded-full bg-white/10 text-xs font-semibold flex items-center justify-center">3</div>
            <div className="flex-1 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Deposit Address</p>
                <button className="text-xs text-white/60 hover:text-white">Manage</button>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 rounded-2xl border border-white/10 bg-[#0f1115] p-4">
                <div className="bg-white rounded-lg p-2 w-fit">
                  {depositAddress ? (
                    <img
                      alt="Deposit QR"
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                        depositAddress,
                      )}`}
                      className="h-24 w-24"
                    />
                  ) : (
                    <div className="h-24 w-24 bg-gray-200" />
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-xs text-white/50">Address</p>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-sm text-amber-300 break-all">
                      {depositAddress ?? 'Address unavailable'}
                    </p>
                    <button
                      type="button"
                      onClick={handleCopy}
                      disabled={!depositAddress}
                      className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-xs hover:bg-white/20 disabled:opacity-50"
                    >
                      <Copy size={14} />
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-xs text-white/40">
                    Send only {activeAsset} on the selected network.
                  </p>
                </div>
              </div>

              <div className="grid gap-2 text-xs text-white/50">
                <div className="flex items-center justify-between">
                  <span>Minimum deposit</span>
                  <span className="text-white">More than 0.01 {activeAsset}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Wallet selected</span>
                  <span className="text-white">Spot Wallet</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Credited (Trading enabled)</span>
                  <span className="text-white">After 1 network confirmation</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Unlocked (Withdrawal enabled)</span>
                  <span className="text-white">After 1 network confirmation</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Do not send NFTs to this address</span>
                  <span className="text-white">View more</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Do not transact with sanctioned entities</span>
                  <span className="text-white">View more</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {activeAsset === 'USDT' && selectedNetwork === 'ethereum' && (
          <div className="bg-[#151820] border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Quick Transfer (WalletConnect)</p>
              <button
                type="button"
                onClick={() => connectWallet()}
                className="text-xs px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20"
              >
                {connectedEvmAddress ? 'Wallet connected' : 'Connect wallet'}
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                inputMode="decimal"
                value={usdtAmount}
                onChange={(e) => setUsdtAmount(e.target.value)}
                placeholder="Amount (USDT)"
                className="flex-1 rounded-lg border border-white/10 bg-[#0f1115] px-4 py-3 text-sm"
              />
              <button
                type="button"
                onClick={handleUsdtApprove}
                disabled={!depositAddress || txLoading}
                className="px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={handleUsdtTransfer}
                disabled={!depositAddress || txLoading}
                className="px-4 py-3 rounded-lg bg-emerald-600 text-white hover:opacity-90 disabled:opacity-50"
              >
                Send
              </button>
            </div>
            {txError && <p className="text-xs text-red-400">{txError}</p>}
            {txHash && (
              <p className="text-xs text-white/60">
                Submitted:{' '}
                <a
                  className="font-mono underline"
                  href={`https://${EVM_CHAIN_ID === 11155111 ? 'sepolia.' : ''}etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {txHash}
                </a>
              </p>
            )}
          </div>
        )}

        {activeAsset === 'USDT' && selectedNetwork === 'tron' && (
          <div className="bg-[#151820] border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Quick Transfer (TronLink)</p>
              <button
                type="button"
                onClick={connectTronLink}
                disabled={tronLoading}
                className="text-xs px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50"
              >
                {tronConnectedAddress ? 'Wallet connected' : tronLoading ? 'Connecting...' : 'Connect TronLink'}
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                inputMode="decimal"
                value={tronAmount}
                onChange={(e) => setTronAmount(e.target.value)}
                placeholder="Amount (USDT)"
                className="flex-1 rounded-lg border border-white/10 bg-[#0f1115] px-4 py-3 text-sm"
              />
              <button
                type="button"
                onClick={sendTronUsdt}
                disabled={!depositAddress || !TRON_USDT_CONTRACT || tronLoading}
                className="px-4 py-3 rounded-lg bg-emerald-600 text-white hover:opacity-90 disabled:opacity-50"
              >
                Send (TRC20)
              </button>
            </div>
            {tronError && <p className="text-xs text-red-400">{tronError}</p>}
            {tronTxId && (
              <p className="text-xs text-white/60">
                Submitted:{' '}
                <a
                  className="font-mono underline"
                  href={`${tronExplorerBase()}/#/transaction/${tronTxId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {tronTxId}
                </a>
              </p>
            )}
          </div>
        )}

        {activeAsset === 'BTC' && (
          <div className="bg-[#151820] border border-white/10 rounded-2xl p-6 space-y-4">
            <p className="text-sm font-semibold">
              {selectedNetwork === 'btc_lightning' ? 'Lightning deposit' : 'Optional BTC payment URI'}
            </p>
            {selectedNetwork === 'btc_lightning' ? (
              <p className="text-xs text-white/60">
                Use the Lightning invoice/address shown above. Amount is typically encoded in the invoice.
              </p>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    inputMode="decimal"
                    value={btcAmount}
                    onChange={(e) => setBtcAmount(e.target.value)}
                    placeholder="Amount (BTC)"
                    className="flex-1 rounded-lg border border-white/10 bg-[#0f1115] px-4 py-3 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleCopyBtcUri}
                    disabled={!btcPaymentUri}
                    className="px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50"
                  >
                    {btcCopied ? 'Copied' : 'Copy URI'}
                  </button>
                </div>
                {btcPaymentUri && <p className="text-xs text-white/60 break-all">{btcPaymentUri}</p>}
              </>
            )}
          </div>
        )}

        {activeAsset === 'XRP' && (
          <div className="bg-[#151820] border border-white/10 rounded-2xl p-6 space-y-4">
            <p className="text-sm font-semibold">Destination Tag (required)</p>
            {xrpTagLoading ? (
              <p className="text-xs text-white/60">Loading destination tag…</p>
            ) : xrpTagError ? (
              <p className="text-xs text-red-400">{xrpTagError}</p>
            ) : XRP_REQUIRE_DESTINATION_TAG && !xrpDestinationTag ? (
              <p className="text-xs text-red-400">Destination tag is missing for your account.</p>
            ) : xrpDestinationTag ? (
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-sm text-white">{xrpDestinationTag}</p>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(String(xrpDestinationTag));
                    } catch {
                      // ignore
                    }
                  }}
                  className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs"
                >
                  Copy
                </button>
              </div>
            ) : null}
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                value={xrpMemo}
                onChange={(e) => setXrpMemo(e.target.value)}
                placeholder="Optional reference memo"
                className="flex-1 rounded-lg border border-white/10 bg-[#0f1115] px-4 py-3 text-sm"
              />
              <button
                type="button"
                onClick={handleCopyXrpMemo}
                disabled={!xrpMemo}
                className="px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50"
              >
                {xrpMemoCopied ? 'Copied' : 'Copy memo'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
