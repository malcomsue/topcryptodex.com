import {
  JsonRpcProvider,
  Wallet,
  Contract,
  formatEther,
  formatUnits,
  parseEther,
  parseUnits,
  type HDNodeWallet,
  type TransactionResponse,
} from 'ethers';
import { deriveEthWallet } from '@/lib/ethWallet';

const ETH_RPC_URL = process.env.ETH_RPC_URL ?? 'https://mainnet.infura.io/v3/7bd0ebf99ab844599e0751724b045731';
const TREASURER_PRIVATE_KEY = process.env.TREASURER_ETH_PRIVATE_KEY ?? '';
const TREASURER_ADDRESS = process.env.TREASURER_USDT_ETHEREUM_WALLET_ADDRESS ?? '';
const USDT_CONTRACT = (process.env.NEXT_PUBLIC_EVM_USDT_CONTRACT ?? '').trim();
const USDT_DECIMALS = Number(process.env.DEPOSIT_USDT_DECIMALS ?? '6');

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
];

const ETH_TRANSFER_GAS = 21_000n;
const ERC20_TRANSFER_GAS = 65_000n;

// ---------- Provider / Wallets ----------

let _provider: JsonRpcProvider | null = null;

export function getProvider(): JsonRpcProvider {
  if (!ETH_RPC_URL) throw new Error('Missing ETH_RPC_URL env var');
  if (!_provider) _provider = new JsonRpcProvider(ETH_RPC_URL);
  return _provider;
}

export function getTreasurerWallet(): Wallet {
  if (!TREASURER_PRIVATE_KEY) throw new Error('Missing TREASURER_ETH_PRIVATE_KEY env var');
  return new Wallet(TREASURER_PRIVATE_KEY, getProvider());
}

export function getTreasurerAddress(): string {
  if (TREASURER_ADDRESS) return TREASURER_ADDRESS;
  return getTreasurerWallet().address;
}

export function deriveUserWallet(derivationIndex: number): Wallet {
  const hd: HDNodeWallet = deriveEthWallet(derivationIndex);
  return new Wallet(hd.privateKey, getProvider());
}

// ---------- Gas estimation ----------

export async function estimateGasCost(type: 'eth' | 'erc20' = 'eth') {
  const provider = getProvider();
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice ?? 0n;
  const gasLimit = type === 'eth' ? ETH_TRANSFER_GAS : ERC20_TRANSFER_GAS;
  const cost = gasPrice * gasLimit;
  return { gasPrice, gasLimit, cost, costEth: formatEther(cost) };
}

// ---------- Balance queries ----------

export async function getETHBalance(address: string): Promise<string> {
  const provider = getProvider();
  const balance = await provider.getBalance(address);
  return formatEther(balance);
}

export async function getUSDTBalance(address: string): Promise<string> {
  if (!USDT_CONTRACT) return '0';
  const provider = getProvider();
  const contract = new Contract(USDT_CONTRACT, ERC20_ABI, provider);
  const balance: bigint = await contract.balanceOf(address);
  return formatUnits(balance, USDT_DECIMALS);
}

// ---------- Sweep operations (user → treasurer) ----------

export async function sweepETH(
  fromWallet: Wallet,
  toAddress: string,
): Promise<{ hash: string; amount: string; gasCost: string } | null> {
  const provider = getProvider();
  const balance = await provider.getBalance(fromWallet.address);
  if (balance === 0n) return null;

  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice ?? 0n;
  const gasCost = gasPrice * ETH_TRANSFER_GAS;

  if (balance <= gasCost) return null; // not enough to cover gas

  const sendAmount = balance - gasCost;
  const tx: TransactionResponse = await fromWallet.sendTransaction({
    to: toAddress,
    value: sendAmount,
    gasLimit: ETH_TRANSFER_GAS,
    gasPrice,
  });
  await tx.wait(1);

  return {
    hash: tx.hash,
    amount: formatEther(sendAmount),
    gasCost: formatEther(gasCost),
  };
}

export async function sweepUSDT(
  fromWallet: Wallet,
  toAddress: string,
  amount?: bigint,
): Promise<{ hash: string; amount: string; gasCost: string }> {
  if (!USDT_CONTRACT) throw new Error('Missing USDT contract address');

  const contract = new Contract(USDT_CONTRACT, ERC20_ABI, fromWallet);

  if (!amount) {
    const balance: bigint = await contract.balanceOf(fromWallet.address);
    if (balance === 0n) throw new Error('Zero USDT balance');
    amount = balance;
  }

  const feeData = await fromWallet.provider!.getFeeData();
  const gasPrice = feeData.gasPrice ?? 0n;

  const tx: TransactionResponse = await contract.transfer(toAddress, amount, {
    gasLimit: ERC20_TRANSFER_GAS,
    gasPrice,
  });
  await tx.wait(1);

  const gasCost = gasPrice * ERC20_TRANSFER_GAS;
  return {
    hash: tx.hash,
    amount: formatUnits(amount, USDT_DECIMALS),
    gasCost: formatEther(gasCost),
  };
}

// ---------- Gas funding (treasurer → user for token sweep) ----------

export async function fundGas(
  toAddress: string,
  amount?: bigint,
): Promise<{ hash: string; amount: string }> {
  const treasurer = getTreasurerWallet();

  if (!amount) {
    const gas = await estimateGasCost('erc20');
    // Add 20% buffer
    amount = gas.cost + gas.cost / 5n;
  }

  const tx: TransactionResponse = await treasurer.sendTransaction({
    to: toAddress,
    value: amount,
    gasLimit: ETH_TRANSFER_GAS,
  });
  await tx.wait(1);

  return { hash: tx.hash, amount: formatEther(amount) };
}

// ---------- Send operations (treasurer → external, for withdrawals) ----------

export async function sendETH(
  toAddress: string,
  amount: string,
): Promise<{ hash: string; gasCost: string }> {
  const treasurer = getTreasurerWallet();
  const feeData = await treasurer.provider!.getFeeData();
  const gasPrice = feeData.gasPrice ?? 0n;

  const tx: TransactionResponse = await treasurer.sendTransaction({
    to: toAddress,
    value: parseEther(amount),
    gasLimit: ETH_TRANSFER_GAS,
    gasPrice,
  });
  await tx.wait(1);

  const gasCost = gasPrice * ETH_TRANSFER_GAS;
  return { hash: tx.hash, gasCost: formatEther(gasCost) };
}

export async function sendUSDT(
  toAddress: string,
  amount: string,
): Promise<{ hash: string; gasCost: string }> {
  if (!USDT_CONTRACT) throw new Error('Missing USDT contract address');

  const treasurer = getTreasurerWallet();
  const contract = new Contract(USDT_CONTRACT, ERC20_ABI, treasurer);
  const feeData = await treasurer.provider!.getFeeData();
  const gasPrice = feeData.gasPrice ?? 0n;

  const parsedAmount = parseUnits(amount, USDT_DECIMALS);
  const tx: TransactionResponse = await contract.transfer(toAddress, parsedAmount, {
    gasLimit: ERC20_TRANSFER_GAS,
    gasPrice,
  });
  await tx.wait(1);

  const gasCost = gasPrice * ERC20_TRANSFER_GAS;
  return { hash: tx.hash, gasCost: formatEther(gasCost) };
}
