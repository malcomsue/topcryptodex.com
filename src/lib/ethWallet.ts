import { HDNodeWallet } from 'ethers';

const mnemonic = process.env.DEPOSIT_ETH_MNEMONIC;
const basePath = process.env.DEPOSIT_ETH_DERIVATION_PATH ?? "m/44'/60'/0'/0";

export function deriveEthAddress(index: number) {
  if (!mnemonic) {
    throw new Error('Missing DEPOSIT_ETH_MNEMONIC');
  }

  const path = `${basePath}/${index}`;
  const wallet = HDNodeWallet.fromPhrase(mnemonic, undefined, path);
  return {
    address: wallet.address,
    derivation_index: index,
    derivation_path: path,
  };
}
