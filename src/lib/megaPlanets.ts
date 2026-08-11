import type { Address, Hex } from 'viem';

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

export const megaPlanetsAbi = [
  {
    type: 'function', name: 'mint', stateMutability: 'nonpayable',
    inputs: [
      { name: 'voucher', type: 'tuple', components: [
        { name: 'recipient', type: 'address' }, { name: 'ticketId', type: 'uint256' }, { name: 'drawingId', type: 'uint256' }, { name: 'originTxHash', type: 'bytes32' }, { name: 'seed', type: 'bytes32' }, { name: 'traitsHash', type: 'bytes32' }, { name: 'metadataHash', type: 'bytes32' }, { name: 'metadataURI', type: 'string' }, { name: 'expiresAt', type: 'uint256' },
      ] },
      { name: 'signature', type: 'bytes' },
    ], outputs: [],
  },
  {
    type: 'function', name: 'mintBatch', stateMutability: 'nonpayable',
    inputs: [
      { name: 'vouchers', type: 'tuple[]', components: [
        { name: 'recipient', type: 'address' }, { name: 'ticketId', type: 'uint256' }, { name: 'drawingId', type: 'uint256' }, { name: 'originTxHash', type: 'bytes32' }, { name: 'seed', type: 'bytes32' }, { name: 'traitsHash', type: 'bytes32' }, { name: 'metadataHash', type: 'bytes32' }, { name: 'metadataURI', type: 'string' }, { name: 'expiresAt', type: 'uint256' },
      ] }, { name: 'signatures', type: 'bytes[]' },
    ], outputs: [],
  },
] as const;
