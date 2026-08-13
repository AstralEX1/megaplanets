import { createPlanetConfig, derivePlanet, GENERATOR_VERSION } from '@megaplanets/planet-generator';
import {
  type Address,
  createPublicClient,
  fallback,
  getAddress,
  type Hex,
  http,
  keccak256,
  stringToHex,
} from 'viem';
import { baseSepolia } from 'viem/chains';
import { BASE_SEPOLIA_CHAIN_ID, MEGAPLANETS_SOURCE } from './config';
import { BASE_SEPOLIA_JACKPOT, type MegasteraProof, normalizeMegasteraProof } from './eligibility';
import type { PrismaClient } from './generated/prisma/client';
import { type PlanetMintedIdentity, PlanetMintProvenanceResolver } from './planetMintProvenance';
import { getLogsAdaptive } from './rpc';
import type { Stage2Config } from './stage2Config';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;
const STREAM = 'megaplanets-v2';

export const PLANET_MINTED_EVENT = {
  type: 'event',
  name: 'PlanetMinted',
  inputs: [
    { indexed: true, name: 'tokenId', type: 'uint256' },
    { indexed: true, name: 'ticketId', type: 'uint256' },
    { indexed: true, name: 'recipient', type: 'address' },
    { indexed: false, name: 'seed', type: 'bytes32' },
    { indexed: false, name: 'metadataHash', type: 'bytes32' },
  ],
} as const;

export const PLANET_TRANSFER_EVENT = {
  type: 'event',
  name: 'Transfer',
  inputs: [
    { indexed: true, name: 'from', type: 'address' },
    { indexed: true, name: 'to', type: 'address' },
    { indexed: true, name: 'tokenId', type: 'uint256' },
  ],
} as const;

const TOKEN_URI_ABI = [
  {
    type: 'function',
    name: 'tokenURI',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'string' }],
  },
] as const;

type EventIdentity = {
  chainId: number;
  contractAddress: Address;
  transactionHash: Hex;
  logIndex: number;
  blockNumber: bigint;
  blockHash: Hex;
  blockTimestamp: Date;
};

type IndexedPlanetTraits = {
  seed: Hex;
  traitsHash: Hex;
  baseMineralsPerDay: number;
  generatorVersion: number;
  planetType: string;
  terrain: string;
  rarity: string;
  satelliteCount: number;
  hasRing: boolean;
};

export type MintedPlanetEvent = EventIdentity & {
  tokenId: bigint;
  ticketId: bigint;
  recipient: Address;
  traits: IndexedPlanetTraits;
  metadataHash: Hex;
  metadataUri: string;
};

export type PlanetTransferEvent = EventIdentity & {
  tokenId: bigint;
  from: Address;
  to: Address;
};

export type PlanetIndexStore = {
  getCursor(
    contractAddress: Address,
  ): Promise<{ nextBlock: bigint; lastBlockHash?: Hex } | undefined>;
  setCursor(contractAddress: Address, nextBlock: bigint, lastBlockHash: Hex): Promise<void>;
  rewind(contractAddress: Address, fromBlock: bigint): Promise<void>;
  recordMinted(event: MintedPlanetEvent, proof: MegasteraProof): Promise<boolean>;
  recordTransfer(event: PlanetTransferEvent): Promise<boolean>;
};

export type PlanetProvenanceResolver = Pick<
  PlanetMintProvenanceResolver,
  'clearCache' | 'resolveMint'
>;

type PrismaTransaction = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

const CANONICAL_TICKET_SOURCE = stringToHex(MEGAPLANETS_SOURCE, { size: 32 }).toLowerCase();

function eventJson(value: Record<string, unknown>): object {
  return JSON.parse(
    JSON.stringify(value, (_key, entry) => (typeof entry === 'bigint' ? entry.toString() : entry)),
  ) as object;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableJson(entry)).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(',')}}`;
}

function decimalString(value: unknown, label: string): string {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value.toString();
  if (
    value &&
    typeof value === 'object' &&
    'toFixed' in value &&
    typeof value.toFixed === 'function'
  ) {
    return value.toFixed(0);
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) return value;
  throw new Error(`Persisted ${label} is invalid.`);
}

function validDate(value: unknown, label: string): Date {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error(`Persisted ${label} is invalid.`);
  return date;
}

function safeLogIndex(value: bigint | number): number {
  const numeric = typeof value === 'bigint' ? Number(value) : value;
  if (!Number.isSafeInteger(numeric) || numeric < 0)
    throw new Error('Megastera proof log index is invalid.');
  return numeric;
}

function addressEqual(left: unknown, right: Address): boolean {
  return typeof left === 'string' && left.toLowerCase() === right.toLowerCase();
}

function hashEqual(left: unknown, right: Hex): boolean {
  return typeof left === 'string' && left.toLowerCase() === right.toLowerCase();
}

function assertTicketMatchesProof(ticket: Record<string, unknown>, proof: MegasteraProof): void {
  const blockHash = proof.blockHash;
  const purchasedAt = proof.purchasedAt;
  if (!blockHash || !purchasedAt)
    throw new Error('Megastera proof lacks finalized TicketPurchased provenance.');
  const expectedLogIndex = safeLogIndex(proof.logIndex);
  const actualNormals = ticket.normals;
  const normalsMatch =
    Array.isArray(actualNormals) &&
    actualNormals.length === proof.normals.length &&
    actualNormals.every((value, index) => value === proof.normals[index]);
  const actualPurchasedAt = validDate(ticket.purchasedAt, 'TicketPurchased timestamp');
  const immutableMatches =
    ticket.chainId === BASE_SEPOLIA_CHAIN_ID &&
    addressEqual(ticket.jackpotAddress, BASE_SEPOLIA_JACKPOT) &&
    decimalString(ticket.ticketId, 'ticket ID') === proof.ticketId.toString() &&
    decimalString(ticket.drawingId, 'drawing ID') === proof.drawingId.toString() &&
    addressEqual(ticket.recipient, proof.recipient) &&
    normalsMatch &&
    ticket.bonusBall === proof.bonusBall &&
    typeof ticket.source === 'string' &&
    ticket.source.toLowerCase() === CANONICAL_TICKET_SOURCE &&
    hashEqual(ticket.originTxHash, proof.originTxHash) &&
    decimalString(ticket.blockNumber, 'block number') === proof.blockNumber.toString() &&
    hashEqual(ticket.blockHash, blockHash) &&
    ticket.logIndex === expectedLogIndex &&
    actualPurchasedAt.getTime() === purchasedAt.getTime();
  if (!immutableMatches) {
    throw new Error(`Ticket ${proof.ticketId} conflicts with immutable Megastera proof fields.`);
  }
}

function assertPlanetMatchesMint(planet: Record<string, unknown>, event: MintedPlanetEvent): void {
  const persistedMintedAt = validDate(planet.mintedAt, 'Planet mintedAt');
  const immutableMatches =
    planet.chainId === event.chainId &&
    addressEqual(planet.contractAddress, event.contractAddress) &&
    decimalString(planet.tokenId, 'Planet token ID') === event.tokenId.toString() &&
    decimalString(planet.ticketId, 'Planet ticket ID') === event.ticketId.toString() &&
    hashEqual(planet.seed, event.traits.seed) &&
    hashEqual(planet.traitsHash, event.traits.traitsHash) &&
    hashEqual(planet.metadataHash, event.metadataHash) &&
    planet.metadataUri === event.metadataUri &&
    decimalString(planet.baseMineralsPerDay, 'Planet mineral rate') ===
      event.traits.baseMineralsPerDay.toString() &&
    planet.generatorVersion === event.traits.generatorVersion &&
    planet.planetType === event.traits.planetType &&
    planet.terrain === event.traits.terrain &&
    planet.rarity === event.traits.rarity &&
    planet.satelliteCount === event.traits.satelliteCount &&
    planet.hasRing === event.traits.hasRing &&
    hashEqual(planet.mintTxHash, event.transactionHash) &&
    decimalString(planet.mintBlockNumber, 'Planet mint block number') ===
      event.blockNumber.toString() &&
    hashEqual(planet.mintBlockHash, event.blockHash) &&
    planet.mintLogIndex === event.logIndex &&
    persistedMintedAt.getTime() === event.blockTimestamp.getTime();
  if (!immutableMatches)
    throw new Error(`Planet ${event.tokenId} conflicts with an existing mint.`);
}

export class PrismaPlanetIndexStore implements PlanetIndexStore {
  public constructor(private readonly prisma: PrismaClient) {}

  async getCursor(contractAddress: Address) {
    const cursor = await this.prisma.indexerCursor.findUnique({
      where: {
        chainId_contractAddress_stream: {
          chainId: BASE_SEPOLIA_CHAIN_ID,
          contractAddress: contractAddress.toLowerCase(),
          stream: STREAM,
        },
      },
    });
    return cursor
      ? { nextBlock: cursor.nextBlock, lastBlockHash: cursor.lastBlockHash as Hex | undefined }
      : undefined;
  }

  async setCursor(contractAddress: Address, nextBlock: bigint, lastBlockHash: Hex) {
    await this.prisma.indexerCursor.upsert({
      where: {
        chainId_contractAddress_stream: {
          chainId: BASE_SEPOLIA_CHAIN_ID,
          contractAddress: contractAddress.toLowerCase(),
          stream: STREAM,
        },
      },
      update: { nextBlock, lastBlockHash },
      create: {
        chainId: BASE_SEPOLIA_CHAIN_ID,
        contractAddress: contractAddress.toLowerCase(),
        stream: STREAM,
        nextBlock,
        lastBlockHash,
      },
    });
  }

  async rewind(contractAddress: Address, fromBlock: bigint): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const normalizedAddress = contractAddress.toLowerCase();
      const reorgedPlanets = await transaction.planet.findMany({
        where: {
          chainId: BASE_SEPOLIA_CHAIN_ID,
          contractAddress: normalizedAddress,
          mintBlockNumber: { gte: fromBlock },
        },
        select: { ticketPurchaseId: true },
      });
      const ticketPurchaseIds = [
        ...new Set(
          reorgedPlanets.flatMap((planet) =>
            planet.ticketPurchaseId ? [planet.ticketPurchaseId] : [],
          ),
        ),
      ];
      await transaction.planetOwnershipHistory.deleteMany({
        where: {
          chainId: BASE_SEPOLIA_CHAIN_ID,
          contractAddress: normalizedAddress,
          blockNumber: { gte: fromBlock },
        },
      });
      await transaction.processedBlockchainEvent.deleteMany({
        where: {
          chainId: BASE_SEPOLIA_CHAIN_ID,
          contractAddress: normalizedAddress,
          blockNumber: { gte: fromBlock },
        },
      });
      await transaction.planet.deleteMany({
        where: {
          chainId: BASE_SEPOLIA_CHAIN_ID,
          contractAddress: normalizedAddress,
          mintBlockNumber: { gte: fromBlock },
        },
      });
      if (ticketPurchaseIds.length > 0) {
        const where = { ticketPurchaseId: { in: ticketPurchaseIds } };
        await transaction.planetArtifact.deleteMany({ where });
        await transaction.mintVoucherRecord.deleteMany({ where });
        await transaction.ticketPurchase.deleteMany({ where: { id: { in: ticketPurchaseIds } } });
      }
      const survivors = await transaction.planet.findMany({
        where: {
          chainId: BASE_SEPOLIA_CHAIN_ID,
          contractAddress: normalizedAddress,
          mintBlockNumber: { lt: fromBlock },
        },
        select: {
          id: true,
          ownershipHistory: {
            where: { blockNumber: { lt: fromBlock } },
            orderBy: [{ blockNumber: 'desc' }, { logIndex: 'desc' }],
            take: 1,
            select: { toAddress: true },
          },
        },
      });
      for (const planet of survivors) {
        await transaction.planet.update({
          where: { id: planet.id },
          data: { ownerAddress: planet.ownershipHistory[0]?.toAddress ?? ZERO_ADDRESS },
        });
      }
      await transaction.indexerCursor.updateMany({
        where: {
          chainId: BASE_SEPOLIA_CHAIN_ID,
          contractAddress: normalizedAddress,
          stream: STREAM,
        },
        data: { nextBlock: fromBlock, lastBlockHash: null },
      });
    });
  }

  async recordMinted(event: MintedPlanetEvent, proof: MegasteraProof): Promise<boolean> {
    const normalizedProof = normalizeMegasteraProof(proof);
    if (!normalizedProof.blockHash || !normalizedProof.purchasedAt) {
      throw new Error('Megastera proof lacks finalized TicketPurchased provenance.');
    }
    if (event.ticketId !== normalizedProof.ticketId) {
      throw new Error(`Planet ${event.tokenId} ticket does not match its Megastera proof.`);
    }
    if (getAddress(event.recipient) !== getAddress(normalizedProof.recipient)) {
      throw new Error(`Planet ${event.tokenId} recipient does not match its Megastera proof.`);
    }
    return this.record(
      event,
      'PlanetMinted',
      async (transaction) => {
        const ticketPurchase = await this.persistProof(transaction, normalizedProof);
        const existing = await transaction.planet.findUnique({
          where: {
            chainId_contractAddress_tokenId: {
              chainId: event.chainId,
              contractAddress: event.contractAddress.toLowerCase(),
              tokenId: event.tokenId.toString(),
            },
          },
        });
        if (existing) {
          assertPlanetMatchesMint(existing, event);
          return;
        }
        await transaction.planet.create({
          data: {
            ticketPurchaseId: ticketPurchase.id as string,
            chainId: event.chainId,
            contractAddress: event.contractAddress.toLowerCase(),
            tokenId: event.tokenId.toString(),
            ticketId: event.ticketId.toString(),
            kind: 'NORMAL',
            ownerAddress: ZERO_ADDRESS,
            seed: event.traits.seed,
            traitsHash: event.traits.traitsHash,
            metadataHash: event.metadataHash,
            metadataUri: event.metadataUri,
            baseMineralsPerDay: BigInt(event.traits.baseMineralsPerDay),
            generatorVersion: event.traits.generatorVersion,
            planetType: event.traits.planetType,
            terrain: event.traits.terrain,
            rarity: event.traits.rarity,
            satelliteCount: event.traits.satelliteCount,
            hasRing: event.traits.hasRing,
            mintTxHash: event.transactionHash.toLowerCase(),
            mintBlockNumber: event.blockNumber,
            mintBlockHash: event.blockHash,
            mintLogIndex: event.logIndex,
            mintedAt: event.blockTimestamp,
          },
        });
      },
      { ...event, proof: normalizedProof },
    );
  }

  async recordTransfer(event: PlanetTransferEvent): Promise<boolean> {
    return this.record(
      event,
      'Transfer',
      async (transaction) => {
        const planet = await transaction.planet.findUnique({
          where: {
            chainId_contractAddress_tokenId: {
              chainId: event.chainId,
              contractAddress: event.contractAddress.toLowerCase(),
              tokenId: event.tokenId.toString(),
            },
          },
        });
        if (!planet) throw new Error(`Transfer references unknown Planet ${event.tokenId}.`);
        const from = getAddress(event.from).toLowerCase();
        const to = getAddress(event.to).toLowerCase();
        if (from !== ZERO_ADDRESS && planet.ownerAddress !== from) {
          throw new Error(`Planet ${event.tokenId} transfer owner is inconsistent.`);
        }
        if (from === ZERO_ADDRESS) {
          if (planet.ownerAddress !== ZERO_ADDRESS) {
            throw new Error(`Planet ${event.tokenId} initial Transfer is not a mint.`);
          }
          if (!planet.ticketPurchaseId || !transaction.ticketPurchase?.findUnique) {
            throw new Error(
              `Planet ${event.tokenId} initial Transfer has no mint recipient provenance.`,
            );
          }
          const ticketPurchase = await transaction.ticketPurchase.findUnique({
            where: { id: planet.ticketPurchaseId },
          });
          if (!ticketPurchase || !addressEqual(ticketPurchase.recipient, to as Address)) {
            throw new Error(
              `Planet ${event.tokenId} initial Transfer recipient is inconsistent with its mint.`,
            );
          }
        }
        await transaction.planetOwnershipHistory.create({
          data: {
            planetId: planet.id,
            chainId: event.chainId,
            contractAddress: event.contractAddress.toLowerCase(),
            fromAddress: from === ZERO_ADDRESS ? null : from,
            toAddress: to === ZERO_ADDRESS ? null : to,
            transactionHash: event.transactionHash.toLowerCase(),
            blockNumber: event.blockNumber,
            blockHash: event.blockHash,
            blockTimestamp: event.blockTimestamp,
            logIndex: event.logIndex,
          },
        });
        await transaction.planet.update({
          where: { id: planet.id },
          data: { ownerAddress: to },
        });
      },
      event as unknown as Record<string, unknown>,
    );
  }

  private async persistProof(
    transaction: PrismaTransaction,
    proof: MegasteraProof,
  ): Promise<Record<string, unknown>> {
    const blockHash = proof.blockHash;
    const purchasedAt = proof.purchasedAt;
    if (!blockHash || !purchasedAt)
      throw new Error('Megastera proof lacks finalized TicketPurchased provenance.');
    const logIndex = safeLogIndex(proof.logIndex);
    const key = {
      chainId_jackpotAddress_ticketId: {
        chainId: BASE_SEPOLIA_CHAIN_ID,
        jackpotAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(),
        ticketId: proof.ticketId.toString(),
      },
    };
    const existing = await transaction.ticketPurchase.findUnique({ where: key });
    if (existing) {
      assertTicketMatchesProof(existing, proof);
      return existing as Record<string, unknown>;
    }

    // The origin transaction/log identity is also immutable and independently unique.
    // Check it before create so a conflicting ticket cannot be hidden behind P2002.
    const byOrigin = await transaction.ticketPurchase.findUnique({
      where: {
        chainId_originTxHash_logIndex: {
          chainId: BASE_SEPOLIA_CHAIN_ID,
          originTxHash: proof.originTxHash.toLowerCase(),
          logIndex,
        },
      },
    });
    if (byOrigin) {
      assertTicketMatchesProof(byOrigin, proof);
      return byOrigin as Record<string, unknown>;
    }

    return transaction.ticketPurchase.create({
      data: {
        chainId: BASE_SEPOLIA_CHAIN_ID,
        jackpotAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(),
        ticketId: proof.ticketId.toString(),
        drawingId: proof.drawingId.toString(),
        recipient: proof.recipient.toLowerCase(),
        normals: [...proof.normals],
        bonusBall: proof.bonusBall,
        source: CANONICAL_TICKET_SOURCE,
        originTxHash: proof.originTxHash.toLowerCase(),
        blockNumber: proof.blockNumber,
        blockHash: blockHash.toLowerCase(),
        logIndex,
        purchasedAt,
      },
    }) as Promise<Record<string, unknown>>;
  }

  private async record(
    identity: EventIdentity,
    eventName: string,
    apply: (transaction: PrismaTransaction) => Promise<void>,
    payload: Record<string, unknown> = identity as unknown as Record<string, unknown>,
  ): Promise<boolean> {
    let applied = false;
    const immutablePayload = eventJson(payload);
    const identityWhere = {
      chainId_contractAddress_transactionHash_logIndex: {
        chainId: identity.chainId,
        contractAddress: identity.contractAddress.toLowerCase(),
        transactionHash: identity.transactionHash.toLowerCase(),
        logIndex: identity.logIndex,
      },
    };
    try {
      await this.prisma.$transaction(async (transaction) => {
        // Serialize replicas on the deployment/event identity before checking
        // and applying it. The unique index remains the final idempotency guard.
        const transactionWithQueryRaw = transaction as typeof transaction & {
          $queryRaw?: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
        };
        if (transactionWithQueryRaw.$queryRaw) {
          await transactionWithQueryRaw.$queryRaw`SELECT 1 AS locked
            FROM (
              SELECT pg_advisory_xact_lock(hashtextextended(${`${identity.chainId}:${identity.contractAddress.toLowerCase()}:${identity.transactionHash.toLowerCase()}:${identity.logIndex}`}, 0)) AS acquired
            ) AS lock_result`;
        }
        const transactionEvents =
          transaction.processedBlockchainEvent as typeof transaction.processedBlockchainEvent & {
            findUnique?: (args: typeof identityWhere) => Promise<unknown>;
          };
        const existing = transactionEvents.findUnique
          ? await transactionEvents.findUnique({ where: identityWhere })
          : await this.prisma.processedBlockchainEvent.findUnique({ where: identityWhere });
        if (existing) {
          this.assertProcessedEventMatches(
            existing as Record<string, unknown>,
            identity,
            eventName,
            immutablePayload,
          );
          return;
        }
        await apply(transaction);
        applied = true;
        await transaction.processedBlockchainEvent.create({
          data: {
            chainId: identity.chainId,
            contractAddress: identity.contractAddress.toLowerCase(),
            transactionHash: identity.transactionHash.toLowerCase(),
            logIndex: identity.logIndex,
            blockNumber: identity.blockNumber,
            blockHash: identity.blockHash,
            eventName,
            payload: immutablePayload,
          },
        });
      });
      return applied;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.processedBlockchainEvent.findUnique({
          where: identityWhere,
        });
        if (existing) {
          this.assertProcessedEventMatches(
            existing as Record<string, unknown>,
            identity,
            eventName,
            immutablePayload,
          );
          return false;
        }
      }
      throw error;
    }
  }

  private assertProcessedEventMatches(
    existing: Record<string, unknown>,
    identity: EventIdentity,
    eventName: string,
    payload: object,
  ): void {
    const sameIdentity =
      existing.eventName === eventName &&
      existing.chainId === identity.chainId &&
      addressEqual(existing.contractAddress, identity.contractAddress) &&
      hashEqual(existing.transactionHash, identity.transactionHash) &&
      existing.logIndex === identity.logIndex &&
      decimalString(existing.blockNumber, 'processed event block number') ===
        identity.blockNumber.toString() &&
      hashEqual(existing.blockHash, identity.blockHash) &&
      stableJson(existing.payload) === stableJson(payload);
    if (!sameIdentity) {
      throw new Error(
        `Processed ${eventName} event ${identity.transactionHash}:${identity.logIndex} conflicts with immutable payload.`,
      );
    }
  }
}

type IndexedLog = {
  kind: 'minted' | 'transfer';
  blockNumber: bigint;
  blockHash: Hex;
  transactionHash: Hex;
  logIndex: number;
  args: Record<string, unknown>;
};

export async function indexPlanetEvents(
  config: Stage2Config,
  store: PlanetIndexStore,
  options: {
    confirmations?: bigint;
    blockRange?: bigint;
    reorgWindow?: bigint;
    provenanceResolver?: PlanetProvenanceResolver;
    resolver?: PlanetProvenanceResolver;
  } = {},
) {
  if (!config.planetContractAddress || config.planetDeploymentBlock === undefined) {
    throw new Error('MegaPlanets address and deployment block are required for indexing.');
  }
  const address = getAddress(config.planetContractAddress);
  const confirmations = options.confirmations ?? 6n;
  const blockRange = options.blockRange ?? 2_000n;
  const reorgWindow = options.reorgWindow ?? 12n;
  if (confirmations < 0n || blockRange < 1n || blockRange > 2_000n || reorgWindow < 1n) {
    throw new Error('Invalid Planet indexer bounds.');
  }
  const client = createPublicClient({
    chain: baseSepolia,
    transport: fallback([
      http(config.rpcUrl),
      ...(config.rpcFallbackUrls ?? []).map((url) => http(url)),
    ]),
  });
  const provenanceResolver =
    options.provenanceResolver ??
    options.resolver ??
    new PlanetMintProvenanceResolver(
      {
        getTransaction: ({ hash }) => client.getTransaction({ hash }),
        getTransactionReceipt: ({ hash }) => client.getTransactionReceipt({ hash }),
        getBlockNumber: () => client.getBlockNumber(),
        getBlock: ({ blockNumber }) => client.getBlock({ blockNumber }),
      },
      { confirmations },
    );
  provenanceResolver.clearCache();
  const latest = await client.getBlockNumber();
  const throughBlock = latest > confirmations ? latest - confirmations : 0n;
  let cursor = await store.getCursor(address);
  let startBlock = cursor?.nextBlock ?? config.planetDeploymentBlock;
  let reorgDetected = false;
  if (cursor?.lastBlockHash && startBlock > config.planetDeploymentBlock) {
    const previous = await client.getBlock({ blockNumber: startBlock - 1n });
    if (previous.hash !== cursor.lastBlockHash) {
      // A single boundary hash cannot prove where the canonical ancestry
      // diverged. Prefer a deployment-scoped replay over retaining potentially
      // stale ownership/provenance outside a guessed bounded window.
      startBlock = config.planetDeploymentBlock;
      await store.rewind(address, startBlock);
      cursor = undefined;
      reorgDetected = true;
    }
  }
  if (startBlock > throughBlock) return { throughBlock, eventsProcessed: 0, reorgDetected };

  const planetConfig = createPlanetConfig();
  let eventsProcessed = 0;
  for (let fromBlock = startBlock; fromBlock <= throughBlock; ) {
    const toBlock =
      fromBlock + blockRange - 1n > throughBlock ? throughBlock : fromBlock + blockRange - 1n;
    const [minted, transfers] = await Promise.all([
      getLogsAdaptive(
        {
          fromBlock,
          toBlock,
          initialRange: blockRange,
          minRange: blockRange > 32n ? 32n : blockRange,
          maxRange: blockRange,
        },
        (rangeStart, rangeEnd) =>
          client.getLogs({
            address,
            event: PLANET_MINTED_EVENT,
            fromBlock: rangeStart,
            toBlock: rangeEnd,
          }),
      ),
      getLogsAdaptive(
        {
          fromBlock,
          toBlock,
          initialRange: blockRange,
          minRange: blockRange > 32n ? 32n : blockRange,
          maxRange: blockRange,
        },
        (rangeStart, rangeEnd) =>
          client.getLogs({
            address,
            event: PLANET_TRANSFER_EVENT,
            fromBlock: rangeStart,
            toBlock: rangeEnd,
          }),
      ),
    ]);
    const logs: IndexedLog[] = [
      ...minted.map((log) => ({ kind: 'minted' as const, ...log, args: log.args })),
      ...transfers.map((log) => ({ kind: 'transfer' as const, ...log, args: log.args })),
    ].map((log) => {
      if (
        log.blockNumber === null ||
        !log.blockHash ||
        !log.transactionHash ||
        log.logIndex === null
      ) {
        throw new Error('Finalized Planet log is missing canonical position data.');
      }
      return {
        ...log,
        blockNumber: log.blockNumber,
        blockHash: log.blockHash,
        transactionHash: log.transactionHash,
        logIndex: log.logIndex,
      } as IndexedLog;
    });
    logs.sort((left, right) => {
      if (left.blockNumber !== right.blockNumber)
        return left.blockNumber < right.blockNumber ? -1 : 1;
      if (
        left.transactionHash === right.transactionHash &&
        left.kind !== 'transfer' &&
        right.kind === 'transfer'
      )
        return -1;
      if (
        left.transactionHash === right.transactionHash &&
        left.kind === 'transfer' &&
        right.kind !== 'transfer'
      )
        return 1;
      return left.logIndex - right.logIndex;
    });

    const blocks = new Map<bigint, Awaited<ReturnType<typeof client.getBlock>>>();
    for (const log of logs) {
      let block = blocks.get(log.blockNumber);
      if (!block) {
        block = await client.getBlock({ blockNumber: log.blockNumber });
        blocks.set(log.blockNumber, block);
      }
      const identity = {
        chainId: BASE_SEPOLIA_CHAIN_ID,
        contractAddress: address,
        transactionHash: log.transactionHash,
        logIndex: log.logIndex,
        blockNumber: log.blockNumber,
        blockHash: log.blockHash,
        blockTimestamp: new Date(Number(block.timestamp) * 1_000),
      };
      if (log.kind === 'minted') {
        const args = log.args as {
          tokenId: bigint;
          ticketId: bigint;
          recipient: Address;
          seed: Hex;
          metadataHash: Hex;
        };
        const mintIdentity: PlanetMintedIdentity = {
          chainId: BASE_SEPOLIA_CHAIN_ID,
          contractAddress: address,
          transactionHash: log.transactionHash,
          logIndex: log.logIndex,
          blockNumber: log.blockNumber,
          blockHash: log.blockHash,
          tokenId: args.tokenId,
          ticketId: args.ticketId,
          recipient: args.recipient,
          seed: args.seed,
          metadataHash: args.metadataHash,
        };
        const { proof, voucher } = await provenanceResolver.resolveMint(address, mintIdentity);
        if (voucher.ticketId !== args.ticketId || voucher.drawingId !== proof.drawingId) {
          throw new Error(
            `Planet ${args.tokenId} voucher ticket or drawing does not match its Megastera proof.`,
          );
        }
        if (
          getAddress(voucher.recipient) !== getAddress(args.recipient) ||
          voucher.originTxHash.toLowerCase() !== proof.originTxHash.toLowerCase() ||
          voucher.seed.toLowerCase() !== args.seed.toLowerCase() ||
          voucher.metadataHash.toLowerCase() !== args.metadataHash.toLowerCase()
        ) {
          throw new Error(
            `Planet ${args.tokenId} mint voucher conflicts with its event or Megastera proof.`,
          );
        }
        const descriptor = derivePlanet(
          {
            ticketId: proof.ticketId,
            drawingId: proof.drawingId,
            normals: proof.normals,
            bonusBall: proof.bonusBall,
            originTxHash: proof.originTxHash,
          },
          planetConfig,
        );
        if (descriptor.seed.toLowerCase() !== args.seed.toLowerCase()) {
          throw new Error(`Planet ${args.tokenId} seed does not match the canonical generator.`);
        }
        if (descriptor.traitsHash.toLowerCase() !== voucher.traitsHash.toLowerCase()) {
          throw new Error(`Planet ${args.tokenId} traits hash does not match the mint voucher.`);
        }
        const traits: IndexedPlanetTraits = {
          seed: descriptor.seed,
          traitsHash: descriptor.traitsHash,
          baseMineralsPerDay: descriptor.traits.minerals,
          generatorVersion: GENERATOR_VERSION,
          planetType: descriptor.traits.typeId,
          terrain: descriptor.traits.terrain,
          rarity: descriptor.traits.rarity,
          satelliteCount: descriptor.traits.satelliteCount,
          hasRing: descriptor.traits.hasRing,
        };
        // tokenURI is immutable after mint, so latest state avoids requiring an archive RPC.
        const metadataUri = await client.readContract({
          address,
          abi: TOKEN_URI_ABI,
          functionName: 'tokenURI',
          args: [args.tokenId],
        });
        if (metadataUri !== voucher.metadataURI) {
          throw new Error(`Planet ${args.tokenId} metadata URI does not match the mint voucher.`);
        }
        if (keccak256(stringToHex(metadataUri)) !== args.metadataHash) {
          throw new Error(`Planet ${args.tokenId} metadata URI hash is invalid.`);
        }
        const mintedEvent: MintedPlanetEvent = { ...identity, ...args, traits, metadataUri };
        if (await store.recordMinted(mintedEvent, proof)) eventsProcessed += 1;
      } else {
        const args = log.args as { tokenId: bigint; from: Address; to: Address };
        if (await store.recordTransfer({ ...identity, ...args })) eventsProcessed += 1;
      }
    }
    const finalBlock = await client.getBlock({ blockNumber: toBlock });
    await store.setCursor(address, toBlock + 1n, finalBlock.hash);
    fromBlock = toBlock + 1n;
  }
  return { fromBlock: startBlock, throughBlock, eventsProcessed, reorgDetected };
}
