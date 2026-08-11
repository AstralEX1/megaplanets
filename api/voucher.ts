import { encodePacked, hashTypedData, keccak256, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { Stage5Config } from './config';

export type MintVoucher = {
  recipient: Address;
  ticketId: bigint;
  drawingId: bigint;
  originTxHash: Hex;
  seed: Hex;
  traitsHash: Hex;
  metadataHash: Hex;
  metadataURI: string;
  expiresAt: bigint;
};

const types = {
  MintVoucher: [
    { name: 'recipient', type: 'address' }, { name: 'ticketId', type: 'uint256' },
    { name: 'drawingId', type: 'uint256' },
    { name: 'originTxHash', type: 'bytes32' }, { name: 'seed', type: 'bytes32' },
    { name: 'traitsHash', type: 'bytes32' }, { name: 'metadataHash', type: 'bytes32' },
    { name: 'metadataURI', type: 'string' }, { name: 'expiresAt', type: 'uint256' },
  ],
} as const;

export async function signMintVoucher(config: Stage5Config, voucher: MintVoucher) {
  if (!config.planetContractAddress) throw new Error('MEGAPLANETS_CONTRACT_ADDRESS is required to sign vouchers.');
  if (keccak256(encodePacked(['string'], [voucher.metadataURI])) !== voucher.metadataHash) {
    throw new Error('Voucher metadata URI hash is invalid.');
  }
  const account = privateKeyToAccount(config.signerPrivateKey);
  const domain = { name: 'MegaPlanets', version: '2', chainId: 84_532, verifyingContract: config.planetContractAddress } as const;
  const signature = await account.signTypedData({ domain, types, primaryType: 'MintVoucher', message: voucher });
  return { voucher, signature, signer: account.address, digest: hashTypedData({ domain, types, primaryType: 'MintVoucher', message: voucher }) };
}
