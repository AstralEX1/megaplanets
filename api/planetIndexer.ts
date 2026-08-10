import {
  createPublicClient,
  getAddress,
  http,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
} from 'viem';
import { baseSepolia } from 'viem/chains';
import {
  createSeason1Config,
  derivePlanet,
  GENERATOR_VERSION,
  type PlanetInput,
} from '@megaplanets/planet-generator';
import { BASE_SEPOLIA_CHAIN_ID, SEASON_1_ID } from './config';
import type { PrismaClient } from './generated/prisma/client';
import { refreshWalletMiningRates } from './miningStore';
import type { Stage2Config } from './stage2Config';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;
const STREAM = 'megaplanets-v1';

export const PLANET_MINTED_EVENT = {
  type: 'event',
  name: 'PlanetMinted',
  inputs: [
    { indexed: true, name: 'tokenId', type: 'uint256' },
    { indexed: true, name: 'ticketId', type: 'uint256' },
    { indexed: true, name: 'recipient', type: 'address' },
    { indexed: false, name: 'seasonId', type: 'bytes32' },
    { indexed: false, name: 'seed', type: 'bytes32' },
    { indexed: false, name: 'metadataHash', type: 'bytes32' },
  ],
} as const;

export const SPECIAL_PLANET_MINTED_EVENT = {
  type: 'event',
  name: 'SpecialPlanetMinted',
  inputs: [
    { indexed: true, name: 'tokenId', type: 'uint256' },
    { indexed: true, name: 'editionId', type: 'uint256' },
    { indexed: true, name: 'recipient', type: 'address' },
    { indexed: false, name: 'seasonId', type: 'bytes32' },
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
  seasonId: Hex;
  traits: IndexedPlanetTraits;
  metadataHash: Hex;
  metadataUri: string;
};

export type SpecialPlanetEvent = EventIdentity & {
  tokenId: bigint;
  editionId: bigint;
  recipient: Address;
  seasonId: Hex;
  metadataUri: string;
};

export type PlanetTransferEvent = EventIdentity & {
  tokenId: bigint;
  from: Address;
  to: Address;
};

export type PlanetIndexStore = {
  getCursor(contractAddress: Address): Promise<{ nextBlock: bigint; lastBlockHash?: Hex } | undefined>;
  setCursor(contractAddress: Address, nextBlock: bigint, lastBlockHash: Hex): Promise<void>;
  rewind(contractAddress: Address, fromBlock: bigint): Promise<void>;
  getTicketInput(ticketId: bigint): Promise<PlanetInput | undefined>;
  recordMinted(event: MintedPlanetEvent): Promise<boolean>;
  recordSpecial(event: SpecialPlanetEvent): Promise<boolean>;
  recordTransfer(event: PlanetTransferEvent): Promise<boolean>;
};

function eventJson(value: Record<string, unknown>): object {
  return JSON.parse(
    JSON.stringify(value, (_key, entry) => (typeof entry === 'bigint' ? entry.toString() : entry)),
  ) as object;
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
      const histories = await transaction.planetOwnershipHistory.findMany({
        where: { planet: { contractAddress: contractAddress.toLowerCase() }, blockNumber: { gte: fromBlock } },
        select: { planetId: true },
      });
      const affected = [...new Set(histories.map((history) => history.planetId))];
      await transaction.planetOwnershipHistory.deleteMany({
        where: { planet: { contractAddress: contractAddress.toLowerCase() }, blockNumber: { gte: fromBlock } },
      });
      await transaction.processedBlockchainEvent.deleteMany({
        where: { contractAddress: contractAddress.toLowerCase(), blockNumber: { gte: fromBlock } },
      });
      await transaction.planet.deleteMany({
        where: { contractAddress: contractAddress.toLowerCase(), mintBlockNumber: { gte: fromBlock } },
      });
      for (const planetId of affected) {
        const planet = await transaction.planet.findUnique({ where: { id: planetId } });
        if (!planet) continue;
        const latest = await transaction.planetOwnershipHistory.findFirst({
          where: { planetId },
          orderBy: [{ blockNumber: 'desc' }, { logIndex: 'desc' }],
        });
        if (!latest) throw new Error(`Planet ${planet.tokenId.toFixed(0)} has no canonical ownership history.`);
        await transaction.planet.update({
          where: { id: planetId },
          data: { ownerAddress: latest.toAddress ?? ZERO_ADDRESS },
        });
      }
      await transaction.indexerCursor.updateMany({
        where: { chainId: BASE_SEPOLIA_CHAIN_ID, contractAddress: contractAddress.toLowerCase(), stream: STREAM },
        data: { nextBlock: fromBlock, lastBlockHash: null },
      });
    });
  }

  async getTicketInput(ticketId: bigint): Promise<PlanetInput | undefined> {
    const ticket = await this.prisma.ticketPurchase.findUnique({
      where: {
        chainId_jackpotAddress_ticketId: {
          chainId: BASE_SEPOLIA_CHAIN_ID,
          jackpotAddress: '0x465da3c859f193a3807386387bee941b2a4c3279',
          ticketId: ticketId.toString(),
        },
      },
    });
    return ticket
      ? {
          seasonId: SEASON_1_ID,
          ticketId,
          drawingId: BigInt(ticket.drawingId.toFixed(0)),
          normals: ticket.normals,
          bonusBall: ticket.bonusBall,
          originTxHash: ticket.originTxHash as Hex,
        }
      : undefined;
  }

  async recordMinted(event: MintedPlanetEvent): Promise<boolean> {
    return this.record(event, 'PlanetMinted', async (transaction) => {
      const ticketPurchase = await transaction.ticketPurchase.findUnique({
        where: {
          chainId_jackpotAddress_ticketId: {
            chainId: event.chainId,
            jackpotAddress: '0x465da3c859f193a3807386387bee941b2a4c3279',
            ticketId: event.ticketId.toString(),
          },
        },
      });
      if (!ticketPurchase) throw new Error(`Ticket ${event.ticketId} is not indexed.`);
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
        if (existing.mintTxHash !== event.transactionHash.toLowerCase() || existing.mintLogIndex !== event.logIndex) {
          throw new Error(`Planet ${event.tokenId} conflicts with an existing mint.`);
        }
        return;
      }
      await transaction.planet.create({
        data: {
          ticketPurchaseId: ticketPurchase.id,
          chainId: event.chainId,
          contractAddress: event.contractAddress.toLowerCase(),
          tokenId: event.tokenId.toString(),
          ticketId: event.ticketId.toString(),
          kind: 'NORMAL',
          ownerAddress: getAddress(event.recipient).toLowerCase(),
          seasonId: event.seasonId,
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
    });
  }

  async recordSpecial(event: SpecialPlanetEvent): Promise<boolean> {
    return this.record(event, 'SpecialPlanetMinted', async (transaction) => {
      await transaction.planet.upsert({
        where: {
          chainId_contractAddress_tokenId: {
            chainId: event.chainId,
            contractAddress: event.contractAddress.toLowerCase(),
            tokenId: event.tokenId.toString(),
          },
        },
        update: {},
        create: {
          chainId: event.chainId,
          contractAddress: event.contractAddress.toLowerCase(),
          tokenId: event.tokenId.toString(),
          kind: 'SPECIAL',
          ownerAddress: getAddress(event.recipient).toLowerCase(),
          seasonId: event.seasonId,
          metadataUri: event.metadataUri,
          mintTxHash: event.transactionHash.toLowerCase(),
          mintBlockNumber: event.blockNumber,
          mintBlockHash: event.blockHash,
          mintLogIndex: event.logIndex,
          mintedAt: event.blockTimestamp,
        },
      });
    });
  }

  async recordTransfer(event: PlanetTransferEvent): Promise<boolean> {
    return this.record(event, 'Transfer', async (transaction) => {
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
      await transaction.planetOwnershipHistory.create({
        data: {
          planetId: planet.id,
          fromAddress: from === ZERO_ADDRESS ? null : from,
          toAddress: to === ZERO_ADDRESS ? null : to,
          transactionHash: event.transactionHash.toLowerCase(),
          blockNumber: event.blockNumber,
          blockHash: event.blockHash,
          blockTimestamp: event.blockTimestamp,
          logIndex: event.logIndex,
        },
      });
      if (from !== ZERO_ADDRESS) {
        await refreshWalletMiningRates(transaction, from, event.blockTimestamp);
      }
      await transaction.planet.update({
        where: { id: planet.id },
        data: { ownerAddress: to },
      });
      if (from !== ZERO_ADDRESS) {
        await transaction.planetAccrualState.updateMany({
          where: { planetId: planet.id, ownerAddress: from },
          data: { ownerAddress: to, startedAt: event.blockTimestamp },
        });
      }
      if (to !== ZERO_ADDRESS) {
        await refreshWalletMiningRates(transaction, to, event.blockTimestamp);
      }
    });
  }

  private async record(
    identity: EventIdentity,
    eventName: string,
    apply: (transaction: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]) => Promise<void>,
  ): Promise<boolean> {
    const existing = await this.prisma.processedBlockchainEvent.findUnique({
      where: {
        chainId_contractAddress_transactionHash_logIndex: {
          chainId: identity.chainId,
          contractAddress: identity.contractAddress.toLowerCase(),
          transactionHash: identity.transactionHash.toLowerCase(),
          logIndex: identity.logIndex,
        },
      },
    });
    if (existing) return false;
    await this.prisma.$transaction(async (transaction) => {
      await apply(transaction);
      await transaction.processedBlockchainEvent.create({
        data: {
          chainId: identity.chainId,
          contractAddress: identity.contractAddress.toLowerCase(),
          transactionHash: identity.transactionHash.toLowerCase(),
          logIndex: identity.logIndex,
          blockNumber: identity.blockNumber,
          blockHash: identity.blockHash,
          eventName,
          payload: eventJson(identity as unknown as Record<string, unknown>),
        },
      });
    });
    return true;
  }
}

type IndexedLog = {
  kind: 'minted' | 'special' | 'transfer';
  blockNumber: bigint;
  blockHash: Hex;
  transactionHash: Hex;
  logIndex: number;
  args: Record<string, unknown>;
};

export async function indexPlanetEvents(
  config: Stage2Config,
  store: PlanetIndexStore,
  options: { confirmations?: bigint; blockRange?: bigint; reorgWindow?: bigint } = {},
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
  const client = createPublicClient({ chain: baseSepolia, transport: http(config.rpcUrl) });
  const latest = await client.getBlockNumber();
  const throughBlock = latest > confirmations ? latest - confirmations : 0n;
  let cursor = await store.getCursor(address);
  let startBlock = cursor?.nextBlock ?? config.planetDeploymentBlock;
  if (cursor?.lastBlockHash && startBlock > config.planetDeploymentBlock) {
    const previous = await client.getBlock({ blockNumber: startBlock - 1n });
    if (previous.hash !== cursor.lastBlockHash) {
      startBlock = startBlock > reorgWindow ? startBlock - reorgWindow : config.planetDeploymentBlock;
      if (startBlock < config.planetDeploymentBlock) startBlock = config.planetDeploymentBlock;
      await store.rewind(address, startBlock);
      cursor = undefined;
    }
  }
  if (startBlock > throughBlock) return { throughBlock, eventsProcessed: 0, reorgDetected: cursor === undefined };

  const season = createSeason1Config(SEASON_1_ID);
  let eventsProcessed = 0;
  for (let fromBlock = startBlock; fromBlock <= throughBlock; ) {
    const toBlock = fromBlock + blockRange - 1n > throughBlock ? throughBlock : fromBlock + blockRange - 1n;
    const [minted, special, transfers] = await Promise.all([
      client.getLogs({ address, event: PLANET_MINTED_EVENT, fromBlock, toBlock }),
      client.getLogs({ address, event: SPECIAL_PLANET_MINTED_EVENT, fromBlock, toBlock }),
      client.getLogs({ address, event: PLANET_TRANSFER_EVENT, fromBlock, toBlock }),
    ]);
    const logs: IndexedLog[] = [
      ...minted.map((log) => ({ kind: 'minted' as const, ...log, args: log.args })),
      ...special.map((log) => ({ kind: 'special' as const, ...log, args: log.args })),
      ...transfers.map((log) => ({ kind: 'transfer' as const, ...log, args: log.args })),
    ].map((log) => {
      if (log.blockNumber === null || !log.blockHash || !log.transactionHash || log.logIndex === null) {
        throw new Error('Finalized Planet log is missing canonical position data.');
      }
      return { ...log, blockNumber: log.blockNumber, blockHash: log.blockHash, transactionHash: log.transactionHash, logIndex: log.logIndex } as IndexedLog;
    });
    logs.sort((left, right) => {
      if (left.blockNumber !== right.blockNumber) return left.blockNumber < right.blockNumber ? -1 : 1;
      if (left.transactionHash === right.transactionHash && left.kind !== 'transfer' && right.kind === 'transfer') return -1;
      if (left.transactionHash === right.transactionHash && left.kind === 'transfer' && right.kind !== 'transfer') return 1;
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
          tokenId: bigint; ticketId: bigint; recipient: Address; seasonId: Hex; seed: Hex;
          metadataHash: Hex;
        };
        const ticketInput = await store.getTicketInput(args.ticketId);
        if (!ticketInput) throw new Error(`Planet ${args.tokenId} has no indexed Megapot ticket provenance.`);
        const descriptor = derivePlanet(ticketInput, season);
        if (args.seasonId !== SEASON_1_ID || descriptor.seed.toLowerCase() !== args.seed.toLowerCase()) {
          throw new Error(`Planet ${args.tokenId} seed does not match the canonical generator.`);
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
        const metadataUri = await client.readContract({ address, abi: TOKEN_URI_ABI, functionName: 'tokenURI', args: [args.tokenId] });
        if (keccak256(stringToHex(metadataUri)) !== args.metadataHash) {
          throw new Error(`Planet ${args.tokenId} metadata URI hash is invalid.`);
        }
        if (await store.recordMinted({ ...identity, ...args, traits, metadataUri })) eventsProcessed += 1;
      } else if (log.kind === 'special') {
        const args = log.args as { tokenId: bigint; editionId: bigint; recipient: Address; seasonId: Hex };
        const metadataUri = await client.readContract({ address, abi: TOKEN_URI_ABI, functionName: 'tokenURI', args: [args.tokenId] });
        if (await store.recordSpecial({ ...identity, ...args, metadataUri })) eventsProcessed += 1;
      } else {
        const args = log.args as { tokenId: bigint; from: Address; to: Address };
        if (await store.recordTransfer({ ...identity, ...args })) eventsProcessed += 1;
      }
    }
    const finalBlock = await client.getBlock({ blockNumber: toBlock });
    await store.setCursor(address, toBlock + 1n, finalBlock.hash);
    fromBlock = toBlock + 1n;
  }
  return { fromBlock: startBlock, throughBlock, eventsProcessed, reorgDetected: cursor === undefined && startBlock !== config.planetDeploymentBlock };
}
