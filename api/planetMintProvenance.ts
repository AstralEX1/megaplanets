import {
  decodeEventLog,
  decodeFunctionData,
  getAddress,
  isHash,
  isHex,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
  type Log,
} from 'viem';
import {
  BASE_SEPOLIA_CHAIN_ID,
  DEFAULT_RECEIPT_CONFIRMATIONS,
  MEGAPLANETS_SOURCE,
  MEGAPLANETS_TICKET_START_BLOCK,
} from './config';
import {
  BASE_SEPOLIA_JACKPOT,
  MegasteraVerifier,
  TICKET_PURCHASED_ABI,
  type MegasteraProof,
} from './eligibility';

/** The checked-in V2 mint entry points. Keep this ABI local to the API projector. */
export const MINT_VOUCHER_ABI = [
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
    outputs: [],
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
    outputs: [],
  },
] as const;

const CANONICAL_SOURCE = stringToHex(MEGAPLANETS_SOURCE, { size: 32 });

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

/** The immutable identity and values emitted by one V2 PlanetMinted event. */
export type PlanetMintedIdentity = {
  chainId: number;
  contractAddress?: Address;
  transactionHash: Hex;
  blockNumber: bigint;
  blockHash: Hex;
  logIndex?: number;
  tokenId?: bigint;
  ticketId: bigint;
  recipient: Address;
  seed: Hex;
  metadataHash: Hex;
};

export type PlanetMintProvenanceResult = {
  proof: MegasteraProof;
  voucher: MintVoucher;
};

/** Narrow, deterministic RPC surface used by the resolver and its tests. */
export type PlanetMintProvenanceReader = {
  getTransaction: (args: { hash: Hex }) => Promise<unknown>;
  getTransactionReceipt: (args: { hash: Hex }) => Promise<unknown>;
  getBlockNumber: () => Promise<bigint>;
  getBlock: (args: { blockNumber: bigint }) => Promise<unknown>;
};

export type PlanetMintProvenanceResolverOptions = {
  confirmations?: bigint;
  minimumTicketBlock?: bigint;
};

export type PlanetMintProvenanceRequest = {
  planetContractAddress: Address;
  identity: PlanetMintedIdentity;
};

type DecodedMint = {
  functionName: 'mint' | 'mintBatch';
  args?: readonly unknown[];
};

type RawTransaction = {
  hash?: unknown;
  to?: unknown;
  blockHash?: unknown;
  blockNumber?: unknown;
  input?: unknown;
  data?: unknown;
};

type RawReceipt = {
  transactionHash?: unknown;
  blockHash?: unknown;
  blockNumber?: unknown;
  status?: unknown;
  logs?: readonly unknown[];
};

type CanonicalBlock = {
  hash: Hex;
  timestamp: bigint;
};

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Planet mint ${label} is malformed.`);
  }
  return value as Record<string, unknown>;
}

function asBigInt(value: unknown, label: string): bigint {
  try {
    const result = typeof value === 'bigint' ? value : BigInt(String(value));
    if (result < 0n) throw new Error();
    return result;
  } catch {
    throw new Error(`Planet mint ${label} is invalid.`);
  }
}

function asHash(value: unknown, label: string): Hex {
  if (typeof value !== 'string' || !isHash(value)) throw new Error(`Planet mint ${label} is invalid.`);
  return value.toLowerCase() as Hex;
}

function asAddress(value: unknown, label: string): Address {
  try {
    return getAddress(String(value));
  } catch {
    throw new Error(`Planet mint ${label} is invalid.`);
  }
}

function sameHash(left: Hex, right: Hex): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function tupleValue(tuple: Record<string, unknown>, name: string, index: number): unknown {
  if (Array.isArray(tuple)) return tuple[index];
  return tuple[name];
}

function normalizeVoucher(value: unknown): MintVoucher {
  const tuple = asRecord(value, 'voucher');
  const recipient = asAddress(tupleValue(tuple, 'recipient', 0), 'voucher recipient');
  const ticketId = asBigInt(tupleValue(tuple, 'ticketId', 1), 'voucher ticket ID');
  const drawingId = asBigInt(tupleValue(tuple, 'drawingId', 2), 'voucher drawing ID');
  const originTxHash = asHash(tupleValue(tuple, 'originTxHash', 3), 'voucher origin transaction hash');
  const seed = asHash(tupleValue(tuple, 'seed', 4), 'voucher seed');
  const traitsHash = asHash(tupleValue(tuple, 'traitsHash', 5), 'voucher traits hash');
  const metadataHash = asHash(tupleValue(tuple, 'metadataHash', 6), 'voucher metadata hash');
  const metadataURI = tupleValue(tuple, 'metadataURI', 7);
  if (typeof metadataURI !== 'string' || metadataURI.length === 0) {
    throw new Error('Planet mint voucher metadata URI is malformed.');
  }
  const expiresAt = asBigInt(tupleValue(tuple, 'expiresAt', 8), 'voucher expiration');
  if (!sameHash(keccak256(stringToHex(metadataURI)), metadataHash)) {
    throw new Error('Planet mint voucher metadata hash does not match metadata URI.');
  }
  return {
    recipient,
    ticketId,
    drawingId,
    originTxHash,
    seed,
    traitsHash,
    metadataHash,
    metadataURI,
    expiresAt,
  };
}

function validateSignature(value: unknown, index?: number): void {
  const label = index === undefined ? 'signature' : `signature ${index}`;
  if (typeof value !== 'string' || !isHex(value) || value.length < 4) {
    throw new Error(`Planet mint ${label} is malformed.`);
  }
}

function normalizeDecodedMint(value: unknown): readonly MintVoucher[] {
  const decoded = value as DecodedMint;
  if (!decoded || (decoded.functionName !== 'mint' && decoded.functionName !== 'mintBatch')) {
    throw new Error('Planet mint calldata selector is not V2 mint or mintBatch.');
  }
  if (!decoded.args || !Array.isArray(decoded.args)) throw new Error('Planet mint calldata arguments are malformed.');
  if (decoded.functionName === 'mint') {
    if (decoded.args.length !== 2) throw new Error('Planet mint calldata arguments are malformed.');
    const signature = decoded.args[1];
    validateSignature(signature);
    return [normalizeVoucher(decoded.args[0])];
  }

  if (decoded.args.length !== 2 || !Array.isArray(decoded.args[0]) || !Array.isArray(decoded.args[1])) {
    throw new Error('Planet mintBatch calldata arguments are malformed.');
  }
  const vouchers = decoded.args[0] as readonly unknown[];
  const signatures = decoded.args[1] as readonly unknown[];
  if (vouchers.length === 0 || vouchers.length !== signatures.length) {
    throw new Error('Planet mintBatch calldata has a signature length mismatch.');
  }
  if (vouchers.length > 50) throw new Error('Planet mintBatch calldata exceeds the 50-voucher contract limit.');
  vouchers.forEach((_voucher, index) => {
    validateSignature(signatures[index], index);
  });
  const normalized = vouchers.map((candidate) => normalizeVoucher(candidate));
  const seen = new Set<string>();
  for (const candidate of normalized) {
    const key = candidate.ticketId.toString();
    if (seen.has(key)) throw new Error(`Planet mintBatch calldata contains duplicate ticket ${key}.`);
    seen.add(key);
  }
  return normalized;
}

function normalizeIdentity(identity: PlanetMintedIdentity): PlanetMintedIdentity {
  if (!identity || typeof identity !== 'object') throw new Error('PlanetMinted identity is malformed.');
  if (identity.chainId !== BASE_SEPOLIA_CHAIN_ID) {
    throw new Error('PlanetMinted event chain is not Base Sepolia.');
  }
  const transactionHash = asHash(identity.transactionHash, 'mint transaction hash');
  const blockHash = asHash(identity.blockHash, 'mint block hash');
  const blockNumber = asBigInt(identity.blockNumber, 'mint block number');
  const ticketId = asBigInt(identity.ticketId, 'PlanetMinted ticket ID');
  const recipient = asAddress(identity.recipient, 'PlanetMinted recipient');
  const seed = asHash(identity.seed, 'PlanetMinted seed');
  const metadataHash = asHash(identity.metadataHash, 'PlanetMinted metadata hash');
  if (identity.contractAddress !== undefined) {
    identity = { ...identity, contractAddress: asAddress(identity.contractAddress, 'PlanetMinted contract address') };
  }
  return {
    ...identity,
    transactionHash,
    blockHash,
    blockNumber,
    ticketId,
    recipient,
    seed,
    metadataHash,
  };
}

function asLog(value: unknown, fallback: { transactionHash: Hex; blockHash: Hex; blockNumber: bigint }): Log {
  const candidate = asRecord(value, 'TicketPurchased log');
  const transactionHash = candidate.transactionHash === undefined
    ? fallback.transactionHash
    : asHash(candidate.transactionHash, 'TicketPurchased transaction hash');
  const blockHash = candidate.blockHash === undefined
    ? fallback.blockHash
    : asHash(candidate.blockHash, 'TicketPurchased block hash');
  const blockNumber = candidate.blockNumber === undefined
    ? fallback.blockNumber
    : asBigInt(candidate.blockNumber, 'TicketPurchased block number');
  const address = asAddress(candidate.address, 'TicketPurchased address');
  if (!Array.isArray(candidate.topics) || typeof candidate.data !== 'string' || !isHex(candidate.data)) {
    throw new Error('TicketPurchased log is malformed.');
  }
  const logIndex = asBigInt(candidate.logIndex, 'TicketPurchased log index');
  if (logIndex > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('TicketPurchased log index is invalid.');
  return {
    ...candidate,
    address,
    topics: candidate.topics as readonly Hex[],
    data: candidate.data as Hex,
    transactionHash,
    blockHash,
    blockNumber,
    logIndex: Number(logIndex),
  } as Log;
}

/**
 * Resolves mint calldata into the canonical Megapot purchase proof it committed to.
 * All RPC reads are injected so a projector cycle can use one deterministic reader.
 */
export class PlanetMintProvenanceResolver {
  private readonly confirmations: bigint;
  private readonly minimumTicketBlock: bigint;
  private readonly verifier: MegasteraVerifier;
  private readonly mintTransactionCache = new Map<string, Promise<RawTransaction>>();
  private readonly originReceiptCache = new Map<string, Promise<RawReceipt>>();
  private readonly blockCache = new Map<string, Promise<CanonicalBlock>>();
  private latestBlockNumber?: Promise<bigint>;

  public constructor(private readonly reader: PlanetMintProvenanceReader, options: PlanetMintProvenanceResolverOptions = {}) {
    this.confirmations = options.confirmations ?? DEFAULT_RECEIPT_CONFIRMATIONS;
    this.minimumTicketBlock = options.minimumTicketBlock ?? MEGAPLANETS_TICKET_START_BLOCK;
    if (this.confirmations < 0n || this.minimumTicketBlock < 0n) {
      throw new Error('Planet mint provenance bounds are invalid.');
    }
    this.verifier = new MegasteraVerifier({ minimumBlock: this.minimumTicketBlock });
  }

  /** Clears this resolver's per-cycle cache before starting a new projector cycle. */
  public clearCache(): void {
    this.mintTransactionCache.clear();
    this.originReceiptCache.clear();
    this.blockCache.clear();
    this.latestBlockNumber = undefined;
  }

  public async resolveMint(
    planetContractAddress: Address,
    identity: PlanetMintedIdentity,
  ): Promise<PlanetMintProvenanceResult> {
    const contractAddress = asAddress(planetContractAddress, 'configured Planet contract address');
    const normalizedIdentity = normalizeIdentity(identity);
    if (normalizedIdentity.contractAddress && normalizedIdentity.contractAddress !== contractAddress) {
      throw new Error('PlanetMinted contract address does not match the configured Planet contract.');
    }

    const vouchers = await this.loadMintVouchers(normalizedIdentity.transactionHash, contractAddress, normalizedIdentity);
    const voucherMatches = vouchers.filter((candidate) => candidate.ticketId === normalizedIdentity.ticketId);
    if (voucherMatches.length !== 1) {
      throw new Error(`PlanetMinted ticket ${normalizedIdentity.ticketId} does not map to exactly one mint voucher.`);
    }
    const voucher = voucherMatches[0];
    if (!voucher) throw new Error(`PlanetMinted ticket ${normalizedIdentity.ticketId} is missing from mint calldata.`);
    if (voucher.recipient !== normalizedIdentity.recipient) throw new Error('PlanetMinted recipient conflicts with mint calldata.');
    if (!sameHash(voucher.seed, normalizedIdentity.seed)) throw new Error('PlanetMinted seed conflicts with mint calldata.');
    if (!sameHash(voucher.metadataHash, normalizedIdentity.metadataHash)) throw new Error('PlanetMinted metadata hash conflicts with mint calldata.');

    const proof = await this.resolveOriginProof(voucher, normalizedIdentity.blockNumber);
    if (proof.ticketId !== voucher.ticketId || proof.drawingId !== voucher.drawingId) {
      throw new Error('Megastera Proof ticket or drawing conflicts with mint calldata.');
    }
    if (proof.recipient !== voucher.recipient) throw new Error('Megastera Proof recipient conflicts with mint calldata.');
    if (!sameHash(proof.originTxHash, voucher.originTxHash)) throw new Error('Megastera Proof transaction conflicts with mint calldata.');
    return { proof, voucher };
  }

  /** Object-form alias for projector callers that carry config and event together. */
  public async resolve(request: PlanetMintProvenanceRequest): Promise<PlanetMintProvenanceResult> {
    return this.resolveMint(request.planetContractAddress, request.identity);
  }

  /** Alias kept explicit for callers naming the PlanetMinted event rather than the mint call. */
  public async resolvePlanetMint(
    planetContractAddress: Address,
    identity: PlanetMintedIdentity,
  ): Promise<PlanetMintProvenanceResult> {
    return this.resolveMint(planetContractAddress, identity);
  }

  private getMintTransaction(hash: Hex): Promise<RawTransaction> {
    const key = hash.toLowerCase();
    const existing = this.mintTransactionCache.get(key);
    if (existing) return existing;
    const pending = this.reader.getTransaction({ hash }).then((value) => asRecord(value, 'mint transaction') as RawTransaction);
    this.mintTransactionCache.set(key, pending);
    return pending;
  }

  private async loadMintVouchers(
    hash: Hex,
    contractAddress: Address,
    identity: PlanetMintedIdentity,
  ): Promise<readonly MintVoucher[]> {
    const transaction = await this.getMintTransaction(hash);
    const transactionHash = asHash(transaction.hash, 'mint transaction hash');
    if (!sameHash(transactionHash, hash)) throw new Error('Mint transaction hash is not canonical.');
    const to = asAddress(transaction.to, 'mint transaction target');
    if (to !== contractAddress) throw new Error('Mint transaction target is not the configured Planet contract.');
    const txBlockNumber = asBigInt(transaction.blockNumber, 'mint transaction block number');
    if (txBlockNumber !== identity.blockNumber) throw new Error('Mint transaction block number conflicts with PlanetMinted event.');
    const txBlockHash = asHash(transaction.blockHash, 'mint transaction block hash');
    if (!sameHash(txBlockHash, identity.blockHash)) throw new Error('Mint transaction block hash conflicts with PlanetMinted event.');
    await this.ensureFinalizedBlock(identity.blockNumber, identity.blockHash, 'mint transaction');

    const input = transaction.input ?? transaction.data;
    if (typeof input !== 'string' || !isHex(input)) throw new Error('Planet mint calldata is malformed.');
    let decoded: unknown;
    try {
      decoded = decodeFunctionData({ abi: MINT_VOUCHER_ABI, data: input });
    } catch {
      throw new Error('Planet mint calldata selector or encoding is malformed.');
    }
    return normalizeDecodedMint(decoded);
  }

  private getOriginReceipt(hash: Hex): Promise<RawReceipt> {
    const key = hash.toLowerCase();
    const existing = this.originReceiptCache.get(key);
    if (existing) return existing;
    const pending = this.reader.getTransactionReceipt({ hash }).then((value) => asRecord(value, 'origin receipt') as RawReceipt);
    this.originReceiptCache.set(key, pending);
    return pending;
  }

  private async resolveOriginProof(voucher: MintVoucher, mintBlockNumber: bigint): Promise<MegasteraProof> {
    const receipt = await this.getOriginReceipt(voucher.originTxHash);
    if (receipt.status !== 'success') throw new Error('Origin transaction receipt did not succeed.');
    const transactionHash = asHash(receipt.transactionHash, 'origin receipt transaction hash');
    if (!sameHash(transactionHash, voucher.originTxHash)) throw new Error('Origin receipt transaction hash is not canonical.');
    const blockHash = asHash(receipt.blockHash, 'origin receipt block hash');
    const blockNumber = asBigInt(receipt.blockNumber, 'origin receipt block number');
    if (blockNumber >= mintBlockNumber) {
      throw new Error('Origin receipt block must precede the Planet mint block.');
    }
    const canonicalBlock = await this.ensureFinalizedBlock(blockNumber, blockHash, 'origin receipt');
    if (!Array.isArray(receipt.logs)) throw new Error('Origin receipt logs are malformed.');

    const matches: Log[] = [];
    for (const rawLog of receipt.logs) {
      const candidate = asRecord(rawLog, 'origin receipt log');
      const address = candidate.address;
      if (typeof address !== 'string') continue;
      let normalizedAddress: Address;
      try {
        normalizedAddress = getAddress(address);
      } catch {
        continue;
      }
      if (normalizedAddress !== BASE_SEPOLIA_JACKPOT) continue;
      if (!Array.isArray(candidate.topics) || typeof candidate.data !== 'string' || !isHex(candidate.data)) continue;
      let event: { eventName?: string; args?: Record<string, unknown> };
      try {
        event = decodeEventLog({
          abi: TICKET_PURCHASED_ABI,
          data: candidate.data as Hex,
          topics: candidate.topics as [Hex, ...Hex[]],
        }) as typeof event;
      } catch {
        continue;
      }
      if (event.eventName !== 'TicketPurchased' || !event.args) continue;
      const eventRecipient = event.args.recipient;
      const eventTicketId = event.args.userTicketId;
      const eventSource = event.args.source;
      if (typeof eventRecipient !== 'string' || typeof eventSource !== 'string') continue;
      let recipient: Address;
      try {
        recipient = getAddress(eventRecipient);
      } catch {
        continue;
      }
      let ticketId: bigint;
      try {
        ticketId = asBigInt(eventTicketId, 'TicketPurchased ticket ID');
      } catch {
        continue;
      }
      if (recipient !== voucher.recipient || ticketId !== voucher.ticketId || !sameHash(eventSource as Hex, CANONICAL_SOURCE)) continue;
      matches.push(asLog(rawLog, { transactionHash, blockHash, blockNumber }));
    }
    if (matches.length !== 1) {
      throw new Error(`Origin receipt must contain exactly one canonical TicketPurchased provenance log; found ${matches.length}.`);
    }
    const logIndex = matches[0]?.logIndex;
    if (typeof logIndex !== 'number' || !Number.isSafeInteger(logIndex) || logIndex < 0) {
      throw new Error('Canonical TicketPurchased log index is missing.');
    }
    const proof = this.verifier.verifyReceipt(
      {
        transactionHash,
        blockHash,
        blockNumber,
        status: 'success',
        logs: matches,
      } as never,
      { logIndex, transactionHash, recipient: voucher.recipient },
    );
    proof.purchasedAt = blockTimestampToDate(canonicalBlock.timestamp);
    return proof;
  }

  private getLatestBlockNumber(): Promise<bigint> {
    if (!this.latestBlockNumber) this.latestBlockNumber = this.reader.getBlockNumber().then((value) => asBigInt(value, 'latest block number'));
    return this.latestBlockNumber;
  }

  private getCanonicalBlock(blockNumber: bigint): Promise<CanonicalBlock> {
    const key = blockNumber.toString();
    const existing = this.blockCache.get(key);
    if (existing) return existing;
    const pending = this.reader.getBlock({ blockNumber }).then((value) => {
      const block = asRecord(value, 'canonical block');
      return {
        hash: asHash(block.hash, 'canonical block hash'),
        timestamp: asBigInt(block.timestamp, 'canonical block timestamp'),
      };
    });
    this.blockCache.set(key, pending);
    return pending;
  }

  private async ensureFinalizedBlock(blockNumber: bigint, blockHash: Hex, label: string): Promise<CanonicalBlock> {
    const latest = await this.getLatestBlockNumber();
    if (latest < blockNumber + this.confirmations) {
      throw new Error(`${label} is under-confirmed; finalized block depth is insufficient.`);
    }
    const canonicalBlock = await this.getCanonicalBlock(blockNumber);
    if (!sameHash(canonicalBlock.hash, blockHash)) throw new Error(`${label} block hash is not canonical.`);
    return canonicalBlock;
  }
}

function blockTimestampToDate(timestamp: bigint): Date {
  const milliseconds = timestamp * 1000n;
  const maxMilliseconds = 8_640_000_000_000_000n;
  if (milliseconds > maxMilliseconds) throw new Error('Canonical block timestamp is outside the supported Date range.');
  const date = new Date(Number(milliseconds));
  if (Number.isNaN(date.getTime())) throw new Error('Canonical block timestamp is invalid.');
  return date;
}
