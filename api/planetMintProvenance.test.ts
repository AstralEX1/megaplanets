import { describe, expect, it, vi } from 'vitest';
import {
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionData,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
} from 'viem';
import { BASE_SEPOLIA_JACKPOT, TICKET_PURCHASED_ABI } from './eligibility';
import {
  PlanetMintProvenanceResolver,
  type PlanetMintedIdentity,
  type PlanetMintProvenanceReader,
  type MintVoucher,
} from './planetMintProvenance';

const CONTRACT = '0x7000000000000000000000000000000000000007' as Address;
const RECIPIENT = '0x1000000000000000000000000000000000000001' as Address;
const OTHER_RECIPIENT = '0x2000000000000000000000000000000000000002' as Address;
const MINT_HASH = `0x${'aa'.repeat(32)}` as Hex;
const ORIGIN_A = `0x${'bb'.repeat(32)}` as Hex;
const ORIGIN_B = `0x${'cc'.repeat(32)}` as Hex;
const MINT_BLOCK = 45_347_900n;
const ORIGIN_BLOCK_A = 45_347_850n;
const ORIGIN_BLOCK_B = 45_347_851n;
const MINT_BLOCK_HASH = `0x${'11'.repeat(32)}` as Hex;
const ORIGIN_BLOCK_HASH_A = `0x${'22'.repeat(32)}` as Hex;
const ORIGIN_BLOCK_HASH_B = `0x${'33'.repeat(32)}` as Hex;
const SEED_A = `0x${'44'.repeat(32)}` as Hex;
const SEED_B = `0x${'55'.repeat(32)}` as Hex;
const TRAITS_A = `0x${'66'.repeat(32)}` as Hex;
const TRAITS_B = `0x${'77'.repeat(32)}` as Hex;
const MINT_TIMESTAMP = 1_760_000_000n;
const ORIGIN_TIMESTAMP_A = 1_759_999_000n;
const ORIGIN_TIMESTAMP_B = 1_759_999_001n;

const MINT_ABI = [
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'voucher',
        type: 'tuple',
        components: [
          { name: 'recipient', type: 'address' },
          { name: 'ticketId', type: 'uint256' },
          { name: 'drawingId', type: 'uint256' },
          { name: 'originTxHash', type: 'bytes32' },
          { name: 'seed', type: 'bytes32' },
          { name: 'traitsHash', type: 'bytes32' },
          { name: 'metadataHash', type: 'bytes32' },
          { name: 'metadataURI', type: 'string' },
          { name: 'expiresAt', type: 'uint256' },
        ],
      },
      { name: 'signature', type: 'bytes' },
    ],
  },
  {
    type: 'function',
    name: 'mintBatch',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'vouchers',
        type: 'tuple[]',
        components: [
          { name: 'recipient', type: 'address' },
          { name: 'ticketId', type: 'uint256' },
          { name: 'drawingId', type: 'uint256' },
          { name: 'originTxHash', type: 'bytes32' },
          { name: 'seed', type: 'bytes32' },
          { name: 'traitsHash', type: 'bytes32' },
          { name: 'metadataHash', type: 'bytes32' },
          { name: 'metadataURI', type: 'string' },
          { name: 'expiresAt', type: 'uint256' },
        ],
      },
      { name: 'signatures', type: 'bytes[]' },
    ],
  },
] as const;

const metadataUri = (ticketId: bigint) => `ipfs://planet-${ticketId.toString()}`;

function voucher(
  ticketId: bigint,
  originTxHash: Hex,
  seed: Hex,
  traitsHash: Hex,
): MintVoucher {
  const metadataURI = metadataUri(ticketId);
  return {
    recipient: RECIPIENT,
    ticketId,
    drawingId: 900n + ticketId,
    originTxHash,
    seed,
    traitsHash,
    metadataHash: keccak256(stringToHex(metadataURI)),
    metadataURI,
    expiresAt: 4_600_000_000n,
  };
}

function ticketLog(
  ticket: MintVoucher,
  blockNumber: bigint,
  blockHash: Hex,
  options: { recipient?: Address; source?: Hex; logIndex?: number } = {},
) {
  const args = {
    recipient: options.recipient ?? ticket.recipient,
    currentDrawingId: ticket.drawingId,
    source: options.source ?? stringToHex('MEGAPLANETS_V1', { size: 32 }),
    userTicketId: ticket.ticketId,
    normals: [1, 2, 3, 4, 5],
    bonusball: 6,
    referralScheme: `0x${'00'.repeat(32)}` as Hex,
  };
  const topics = encodeEventTopics({ abi: TICKET_PURCHASED_ABI, eventName: 'TicketPurchased', args });
  const data = encodeAbiParameters(
    [
      { type: 'uint256' },
      { type: 'uint8[]' },
      { type: 'uint8' },
      { type: 'bytes32' },
    ],
    [args.userTicketId, args.normals, args.bonusball, args.referralScheme],
  );
  return {
    address: BASE_SEPOLIA_JACKPOT,
    topics,
    data,
    blockNumber,
    blockHash,
    transactionHash: ticket.originTxHash,
    logIndex: options.logIndex ?? 4,
    removed: false,
  } as const;
}

function receipt(
  ticket: MintVoucher,
  blockNumber: bigint,
  blockHash: Hex,
  logs = [ticketLog(ticket, blockNumber, blockHash)],
) {
  return {
    transactionHash: ticket.originTxHash,
    blockHash,
    blockNumber,
    status: 'success' as 'success' | 'reverted',
    logs,
  };
}

function event(
  ticket: MintVoucher,
  options: Partial<PlanetMintedIdentity> = {},
): PlanetMintedIdentity {
  return {
    chainId: 84_532,
    contractAddress: CONTRACT,
    transactionHash: MINT_HASH,
    blockNumber: MINT_BLOCK,
    blockHash: MINT_BLOCK_HASH,
    logIndex: 12,
    tokenId: ticket.ticketId + 100n,
    ticketId: ticket.ticketId,
    recipient: ticket.recipient,
    seed: ticket.seed,
    metadataHash: ticket.metadataHash,
    ...options,
  };
}

function mintTransaction(input: Hex, overrides: Record<string, unknown> = {}) {
  return {
    hash: MINT_HASH,
    to: CONTRACT,
    blockHash: MINT_BLOCK_HASH,
    blockNumber: MINT_BLOCK,
    input,
    ...overrides,
  };
}

function reader(
  transaction: ReturnType<typeof mintTransaction>,
  receipts: Record<string, ReturnType<typeof receipt>>,
  blocks: Record<string, Hex | { hash: Hex; timestamp: bigint }> = {
    [MINT_BLOCK.toString()]: { hash: MINT_BLOCK_HASH, timestamp: MINT_TIMESTAMP },
    [ORIGIN_BLOCK_A.toString()]: { hash: ORIGIN_BLOCK_HASH_A, timestamp: ORIGIN_TIMESTAMP_A },
    [ORIGIN_BLOCK_B.toString()]: { hash: ORIGIN_BLOCK_HASH_B, timestamp: ORIGIN_TIMESTAMP_B },
  },
) {
  return {
    getTransaction: vi.fn().mockResolvedValue(transaction),
    getTransactionReceipt: vi.fn(async ({ hash }: { hash: Hex }) => receipts[hash.toLowerCase()]),
    getBlockNumber: vi.fn().mockResolvedValue(45_348_100n),
    getBlock: vi.fn(async ({ blockNumber }: { blockNumber: bigint }) => {
      const block = blocks[blockNumber.toString()];
      return typeof block === 'string' ? { hash: block, timestamp: 1_760_000_000n } : block;
    }),
  } satisfies PlanetMintProvenanceReader;
}

function resolverFor(
  tx: ReturnType<typeof mintTransaction>,
  receipts: Record<string, ReturnType<typeof receipt>>,
  blocks?: Record<string, Hex>,
) {
  return new PlanetMintProvenanceResolver(reader(tx, receipts, blocks));
}

describe('PlanetMintProvenanceResolver', () => {
  it('resolves a single mint voucher to a complete canonical Megastera Proof', async () => {
    const first = voucher(101n, ORIGIN_A, SEED_A, TRAITS_A);
    const input = encodeFunctionData({ abi: MINT_ABI, functionName: 'mint', args: [first, '0x1234'] });
    const resolver = resolverFor(
      mintTransaction(input),
      { [ORIGIN_A.toLowerCase()]: receipt(first, ORIGIN_BLOCK_A, ORIGIN_BLOCK_HASH_A) },
    );

    const result = await resolver.resolveMint(CONTRACT, event(first));

    expect(result.voucher).toEqual(first);
    expect(result.proof).toMatchObject({
      chainId: 84_532,
      jackpotAddress: BASE_SEPOLIA_JACKPOT,
      source: stringToHex('MEGAPLANETS_V1', { size: 32 }),
      recipient: RECIPIENT,
      ticketId: 101n,
      drawingId: 1001n,
      originTxHash: ORIGIN_A,
      normals: [1, 2, 3, 4, 5],
      bonusBall: 6,
      blockNumber: ORIGIN_BLOCK_A,
      blockHash: ORIGIN_BLOCK_HASH_A,
      logIndex: 4n,
      purchasedAt: new Date(Number(ORIGIN_TIMESTAMP_A) * 1000),
    });
  });

  it('maps every batch PlanetMinted ticket to exactly one voucher and reuses cached reads', async () => {
    const first = voucher(101n, ORIGIN_A, SEED_A, TRAITS_A);
    const second = voucher(102n, ORIGIN_B, SEED_B, TRAITS_B);
    const input = encodeFunctionData({
      abi: MINT_ABI,
      functionName: 'mintBatch',
      args: [[first, second], ['0x1234', '0x5678']],
    });
    const rpc = reader(mintTransaction(input), {
      [ORIGIN_A.toLowerCase()]: receipt(first, ORIGIN_BLOCK_A, ORIGIN_BLOCK_HASH_A),
      [ORIGIN_B.toLowerCase()]: receipt(second, ORIGIN_BLOCK_B, ORIGIN_BLOCK_HASH_B),
    });
    const resolver = new PlanetMintProvenanceResolver(rpc);

    await expect(resolver.resolveMint(CONTRACT, event(first))).resolves.toMatchObject({ voucher: first });
    await expect(resolver.resolveMint(CONTRACT, event(second))).resolves.toMatchObject({ voucher: second });
    await resolver.resolveMint(CONTRACT, event(first));

    expect(rpc.getTransaction).toHaveBeenCalledTimes(1);
    expect(rpc.getTransactionReceipt).toHaveBeenCalledTimes(2);
  });

  it('revalidates cached transaction context for every PlanetMinted identity', async () => {
    const first = voucher(101n, ORIGIN_A, SEED_A, TRAITS_A);
    const input = encodeFunctionData({ abi: MINT_ABI, functionName: 'mint', args: [first, '0x1234'] });
    const rpc = reader(mintTransaction(input), {
      [ORIGIN_A.toLowerCase()]: receipt(first, ORIGIN_BLOCK_A, ORIGIN_BLOCK_HASH_A),
    });
    const resolver = new PlanetMintProvenanceResolver(rpc);

    await expect(resolver.resolveMint(CONTRACT, event(first))).resolves.toBeTruthy();
    await expect(
      resolver.resolveMint(OTHER_RECIPIENT, event(first, { contractAddress: OTHER_RECIPIENT })),
    ).rejects.toThrow(/target|contract/i);
    await expect(
      resolver.resolveMint(CONTRACT, event(first, { blockHash: ORIGIN_BLOCK_HASH_A })),
    ).rejects.toThrow(/block/i);
    expect(rpc.getTransaction).toHaveBeenCalledTimes(1);
  });

  it('requires an explicit Base Sepolia chain ID on every PlanetMinted identity', async () => {
    const first = voucher(101n, ORIGIN_A, SEED_A, TRAITS_A);
    const input = encodeFunctionData({ abi: MINT_ABI, functionName: 'mint', args: [first, '0x1234'] });
    const resolver = resolverFor(
      mintTransaction(input),
      { [ORIGIN_A.toLowerCase()]: receipt(first, ORIGIN_BLOCK_A, ORIGIN_BLOCK_HASH_A) },
    );
    const missingChainId = { ...event(first), chainId: undefined } as unknown as PlanetMintedIdentity;

    await expect(resolver.resolveMint(CONTRACT, missingChainId)).rejects.toThrow(/chain/i);
  });

  it('rejects malformed selectors, duplicate vouchers, and missing ticket mappings', async () => {
    const first = voucher(101n, ORIGIN_A, SEED_A, TRAITS_A);
    const malformed = resolverFor(
      mintTransaction('0xdeadbeef'),
      { [ORIGIN_A.toLowerCase()]: receipt(first, ORIGIN_BLOCK_A, ORIGIN_BLOCK_HASH_A) },
    );
    await expect(malformed.resolveMint(CONTRACT, event(first))).rejects.toThrow(/selector|calldata/i);

    const duplicateInput = encodeFunctionData({
      abi: MINT_ABI,
      functionName: 'mintBatch',
      args: [[first, first], ['0x1234', '0x5678']],
    });
    const duplicate = resolverFor(
      mintTransaction(duplicateInput),
      { [ORIGIN_A.toLowerCase()]: receipt(first, ORIGIN_BLOCK_A, ORIGIN_BLOCK_HASH_A) },
    );
    await expect(duplicate.resolveMint(CONTRACT, event(first))).rejects.toThrow(/duplicate/i);

    const tooMany = Array.from({ length: 51 }, (_, index) =>
      voucher(BigInt(10_000 + index), `0x${(index + 1).toString(16).padStart(64, '0')}` as Hex, SEED_A, TRAITS_A));
    const tooManyInput = encodeFunctionData({
      abi: MINT_ABI,
      functionName: 'mintBatch',
      args: [tooMany, tooMany.map(() => '0x1234')],
    });
    const tooManyResolver = resolverFor(mintTransaction(tooManyInput), {});
    const firstTooMany = tooMany[0];
    if (!firstTooMany) throw new Error('Test fixture did not create a first batch voucher.');
    await expect(tooManyResolver.resolveMint(CONTRACT, event(firstTooMany))).rejects.toThrow(/50|batch/i);

    const missingInput = encodeFunctionData({
      abi: MINT_ABI,
      functionName: 'mint',
      args: [first, '0x1234'],
    });
    const missing = resolverFor(
      mintTransaction(missingInput),
      { [ORIGIN_A.toLowerCase()]: receipt(first, ORIGIN_BLOCK_A, ORIGIN_BLOCK_HASH_A) },
    );
    await expect(missing.resolveMint(CONTRACT, event({ ...first, ticketId: 999n }))).rejects.toThrow(/voucher|ticket/i);
  });

  it('rejects wrong transaction target or block and conflicting PlanetMinted values', async () => {
    const first = voucher(101n, ORIGIN_A, SEED_A, TRAITS_A);
    const input = encodeFunctionData({ abi: MINT_ABI, functionName: 'mint', args: [first, '0x1234'] });
    const receipts = { [ORIGIN_A.toLowerCase()]: receipt(first, ORIGIN_BLOCK_A, ORIGIN_BLOCK_HASH_A) };

    await expect(
      resolverFor(mintTransaction(input, { to: OTHER_RECIPIENT }), receipts).resolveMint(CONTRACT, event(first)),
    ).rejects.toThrow(/target|contract/i);
    await expect(
      resolverFor(mintTransaction(input, { blockHash: ORIGIN_BLOCK_HASH_A }), receipts).resolveMint(CONTRACT, event(first)),
    ).rejects.toThrow(/block/i);
    await expect(
      resolverFor(mintTransaction(input), receipts).resolveMint(CONTRACT, event({ ...first, recipient: OTHER_RECIPIENT })),
    ).rejects.toThrow(/recipient/i);
    await expect(
      resolverFor(mintTransaction(input), receipts).resolveMint(CONTRACT, event({ ...first, seed: SEED_B })),
    ).rejects.toThrow(/seed/i);
    await expect(
      resolverFor(mintTransaction(input), receipts).resolveMint(CONTRACT, event({ ...first, metadataHash: SEED_B })),
    ).rejects.toThrow(/metadata/i);
  });

  it('rejects a voucher whose metadata URI hash is not canonical', async () => {
    const first = { ...voucher(101n, ORIGIN_A, SEED_A, TRAITS_A), metadataHash: SEED_B };
    const input = encodeFunctionData({ abi: MINT_ABI, functionName: 'mint', args: [first, '0x1234'] });
    const resolver = resolverFor(
      mintTransaction(input),
      { [ORIGIN_A.toLowerCase()]: receipt(first, ORIGIN_BLOCK_A, ORIGIN_BLOCK_HASH_A) },
    );
    await expect(resolver.resolveMint(CONTRACT, event(first))).rejects.toThrow(/metadata hash/i);
  });

  it('requires exactly one canonical TicketPurchased event with matching ticket and recipient', async () => {
    const first = voucher(101n, ORIGIN_A, SEED_A, TRAITS_A);
    const input = encodeFunctionData({ abi: MINT_ABI, functionName: 'mint', args: [first, '0x1234'] });
    const common = { [ORIGIN_A.toLowerCase()]: receipt(first, ORIGIN_BLOCK_A, ORIGIN_BLOCK_HASH_A) };

    const missing = receipt(first, ORIGIN_BLOCK_A, ORIGIN_BLOCK_HASH_A, []);
    await expect(resolverFor(mintTransaction(input), { [ORIGIN_A.toLowerCase()]: missing }).resolveMint(CONTRACT, event(first))).rejects.toThrow(/TicketPurchased|provenance/i);

    const ambiguous = receipt(first, ORIGIN_BLOCK_A, ORIGIN_BLOCK_HASH_A, [
      ticketLog(first, ORIGIN_BLOCK_A, ORIGIN_BLOCK_HASH_A, { logIndex: 4 }),
      ticketLog(first, ORIGIN_BLOCK_A, ORIGIN_BLOCK_HASH_A, { logIndex: 5 }),
    ]);
    await expect(resolverFor(mintTransaction(input), { [ORIGIN_A.toLowerCase()]: ambiguous }).resolveMint(CONTRACT, event(first))).rejects.toThrow(/exactly one|ambiguous/i);

    const wrongSource = receipt(first, ORIGIN_BLOCK_A, ORIGIN_BLOCK_HASH_A, [
      ticketLog(first, ORIGIN_BLOCK_A, ORIGIN_BLOCK_HASH_A, { source: stringToHex('OTHER_SOURCE', { size: 32 }) }),
    ]);
    await expect(resolverFor(mintTransaction(input), { [ORIGIN_A.toLowerCase()]: wrongSource }).resolveMint(CONTRACT, event(first))).rejects.toThrow(/source|TicketPurchased/i);

    const wrongRecipient = receipt(first, ORIGIN_BLOCK_A, ORIGIN_BLOCK_HASH_A, [
      ticketLog(first, ORIGIN_BLOCK_A, ORIGIN_BLOCK_HASH_A, { recipient: OTHER_RECIPIENT }),
    ]);
    await expect(resolverFor(mintTransaction(input), { [ORIGIN_A.toLowerCase()]: wrongRecipient }).resolveMint(CONTRACT, event(first))).rejects.toThrow(/ticket|recipient|provenance/i);

    await expect(resolverFor(mintTransaction(input), common).resolveMint(CONTRACT, event(first))).resolves.toBeTruthy();
  });

  it('rejects failed, under-confirmed, and noncanonical origin receipts', async () => {
    const first = voucher(101n, ORIGIN_A, SEED_A, TRAITS_A);
    const input = encodeFunctionData({ abi: MINT_ABI, functionName: 'mint', args: [first, '0x1234'] });
    const failed = {
      ...receipt(first, ORIGIN_BLOCK_A, ORIGIN_BLOCK_HASH_A),
      status: 'reverted' as const,
    };
    await expect(resolverFor(mintTransaction(input), { [ORIGIN_A.toLowerCase()]: failed }).resolveMint(CONTRACT, event(first))).rejects.toThrow(/succeed|receipt/i);

    const underConfirmedReader = reader(
      mintTransaction(input),
      { [ORIGIN_A.toLowerCase()]: receipt(first, ORIGIN_BLOCK_A, ORIGIN_BLOCK_HASH_A) },
    );
    underConfirmedReader.getBlockNumber.mockResolvedValue(ORIGIN_BLOCK_A + 5n);
    await expect(new PlanetMintProvenanceResolver(underConfirmedReader).resolveMint(CONTRACT, event(first))).rejects.toThrow(/confirm/i);

    const wrongCanonicalBlock = reader(
      mintTransaction(input),
      { [ORIGIN_A.toLowerCase()]: receipt(first, ORIGIN_BLOCK_A, ORIGIN_BLOCK_HASH_A) },
      {
        [MINT_BLOCK.toString()]: MINT_BLOCK_HASH,
        [ORIGIN_BLOCK_A.toString()]: ORIGIN_BLOCK_HASH_B,
      },
    );
    await expect(new PlanetMintProvenanceResolver(wrongCanonicalBlock).resolveMint(CONTRACT, event(first))).rejects.toThrow(/canonical|block/i);

    const wrongReceiptHash = {
      ...receipt(first, ORIGIN_BLOCK_A, ORIGIN_BLOCK_HASH_A),
      blockHash: ORIGIN_BLOCK_HASH_B,
    };
    await expect(resolverFor(mintTransaction(input), { [ORIGIN_A.toLowerCase()]: wrongReceiptHash }).resolveMint(CONTRACT, event(first))).rejects.toThrow(/canonical|block/i);

    const sameBlock = reader(
      mintTransaction(input),
      { [ORIGIN_A.toLowerCase()]: receipt(first, MINT_BLOCK, MINT_BLOCK_HASH) },
      { [MINT_BLOCK.toString()]: { hash: MINT_BLOCK_HASH, timestamp: MINT_TIMESTAMP } },
    );
    await expect(new PlanetMintProvenanceResolver(sameBlock).resolveMint(CONTRACT, event(first))).rejects.toThrow(/before|block/i);

    const laterBlock = reader(
      mintTransaction(input),
      { [ORIGIN_A.toLowerCase()]: receipt(first, MINT_BLOCK + 1n, ORIGIN_BLOCK_HASH_A) },
      {
        [MINT_BLOCK.toString()]: { hash: MINT_BLOCK_HASH, timestamp: MINT_TIMESTAMP },
        [(MINT_BLOCK + 1n).toString()]: { hash: ORIGIN_BLOCK_HASH_A, timestamp: MINT_TIMESTAMP + 1n },
      },
    );
    await expect(new PlanetMintProvenanceResolver(laterBlock).resolveMint(CONTRACT, event(first))).rejects.toThrow(/before|block/i);
  });
});
