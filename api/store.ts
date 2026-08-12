import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { getAddress, isAddress, isHash, type Address, type Hex } from 'viem';
import { normalizeMegasteraProof, type EligibleTicket, type MegasteraProof, type MegasteraProofReference } from './eligibility';
import type { DailySnapshot, PlanetHolding } from './scoring';
import type { MintVoucher } from './voucher';
import { MEGAPLANETS_TICKET_START_BLOCK } from './config';

export type PreparedVoucher = {
  voucher: MintVoucher;
  signature: Hex;
  signer: Address;
  digest: Hex;
  /** Internal handoff used to persist immutable media separately from signatures. */
  artifact?: PlanetArtifact;
};

export type PlanetArtifact = {
  key: string;
  ticketId: string;
  recipient: Address;
  seed: Hex;
  traitsHash: Hex;
  metadataHash: Hex;
  metadataURI: string;
  mediaURI: string;
  mediaHash: Hex;
};

export type IndexedTicket = EligibleTicket;

export type IndexerCursor = {
  nextBlock: bigint;
  lastBlockHash?: Hex;
};

export type ProofPagination = { offset: number; limit: number };
export type ProofListResult = {
  total: number;
  offset: number;
  limit: number;
  proofs: MegasteraProof[];
};

export type EligibilityStore = {
  saveTicket(ticket: IndexedTicket): Promise<void>;
  saveProof(proof: MegasteraProof): Promise<void>;
  getProof(reference: MegasteraProofReference | Hex, logIndex?: bigint | number): Promise<MegasteraProof | undefined>;
  listProofs(recipient: Address, pagination: ProofPagination): Promise<ProofListResult>;
  getVoucher(ticketId: bigint, recipient: Address, now: bigint): Promise<PreparedVoucher | undefined>;
  saveVoucher(prepared: PreparedVoucher): Promise<void>;
  getArtifact?(key: string): Promise<PlanetArtifact | undefined>;
  saveArtifact?(artifact: PlanetArtifact): Promise<void>;
  getCursor(): Promise<IndexerCursor | undefined>;
  setCursor(nextBlock: bigint, lastBlockHash: Hex): Promise<void>;
  rewind(fromBlock: bigint): Promise<void>;
  getSnapshot(blockNumber: bigint): Promise<DailySnapshot | undefined>;
  saveSnapshot(snapshot: DailySnapshot): Promise<void>;
};

type PersistedStore = {
  version: 2;
  cursor?: { nextBlock: string; lastBlockHash?: Hex };
  cursorEpoch?: string;
  tickets: Record<string, PersistedTicket>;
  vouchers: Record<string, PersistedVoucher>;
  snapshots: Record<string, PersistedSnapshot>;
  artifacts?: Record<string, PlanetArtifact>;
};
type PersistedTicket = Omit<IndexedTicket, 'ticketId' | 'drawingId' | 'blockNumber' | 'logIndex'> & {
  ticketId: string;
  drawingId: string;
  blockNumber: string;
  logIndex: string;
};
export type PersistedVoucher = Omit<PreparedVoucher, 'voucher'> & {
  voucher: Omit<MintVoucher, 'ticketId' | 'drawingId' | 'expiresAt'> & { ticketId: string; drawingId: string; expiresAt: string };
};
type PersistedHolding = Omit<PlanetHolding, 'tokenId' | 'minerals'> & { tokenId: string; minerals: string };
export type PersistedSnapshot = Omit<DailySnapshot, 'blockNumber' | 'holdings' | 'wallets'> & {
  blockNumber: string;
  holdings: PersistedHolding[];
  wallets: Array<Omit<DailySnapshot['wallets'][number], 'tokenIds' | 'typeScores' | 'diversityMultiplierBps' | 'score'> & {
    tokenIds: string[];
    typeScores: Array<Omit<DailySnapshot['wallets'][number]['typeScores'][number], 'minerals' | 'multiplierBps' | 'score'> & { minerals: string; multiplierBps: string; score: string }>;
    diversityMultiplierBps: string;
    score: string;
  }>;
};

const emptyStore = (): PersistedStore => ({ version: 2, cursorEpoch: MEGAPLANETS_TICKET_START_BLOCK.toString(), tickets: {}, vouchers: {}, snapshots: {}, artifacts: {} });
const voucherKey = (ticketId: bigint, recipient: Address) => `${ticketId}:${getAddress(recipient).toLowerCase()}`;
const snapshotKey = (blockNumber: bigint) => blockNumber.toString();

function serializeTicket(ticket: IndexedTicket): PersistedTicket {
  return { ...ticket, ticketId: ticket.ticketId.toString(), drawingId: ticket.drawingId.toString(), blockNumber: ticket.blockNumber.toString(), logIndex: ticket.logIndex.toString() };
}

function deserializeTicket(ticket: PersistedTicket): IndexedTicket {
  return { ...ticket, recipient: getAddress(ticket.recipient), ticketId: BigInt(ticket.ticketId), drawingId: BigInt(ticket.drawingId), blockNumber: BigInt(ticket.blockNumber), logIndex: BigInt(ticket.logIndex) };
}

function proofReferenceKey(reference: MegasteraProofReference | Hex, logIndexOverride?: bigint | number): string {
  const normalizedReference = typeof reference === 'string'
    ? { transactionHash: reference, logIndex: logIndexOverride }
    : reference;
  const transactionHash = normalizedReference.transactionHash ?? normalizedReference.originTxHash;
  if (!transactionHash) throw new Error('Megastera proof transaction hash is required.');
  if (normalizedReference.logIndex === undefined) throw new Error('Megastera proof log index is required.');
  const logIndex = typeof normalizedReference.logIndex === 'bigint' ? normalizedReference.logIndex : BigInt(normalizedReference.logIndex);
  if (logIndex < 0n) throw new Error('Megastera proof log index is invalid.');
  return `${transactionHash.toLowerCase()}:${logIndex.toString()}`;
}

function proofFromTicket(ticket: IndexedTicket): MegasteraProof {
  return normalizeMegasteraProof(ticket as MegasteraProof);
}

export function serializePreparedVoucher(prepared: PreparedVoucher): PersistedVoucher {
  const { voucher } = prepared;
  const { artifact: _artifact, ...persisted } = prepared;
  return { ...persisted, voucher: { ...voucher, ticketId: voucher.ticketId.toString(), drawingId: voucher.drawingId.toString(), expiresAt: voucher.expiresAt.toString() } };
}

export function deserializePreparedVoucher(prepared: PersistedVoucher): PreparedVoucher {
  const { voucher } = prepared;
  return { ...prepared, signer: getAddress(prepared.signer), voucher: { ...voucher, recipient: getAddress(voucher.recipient), ticketId: BigInt(voucher.ticketId), drawingId: BigInt(voucher.drawingId), expiresAt: BigInt(voucher.expiresAt) } };
}

export function serializeDailySnapshot(snapshot: DailySnapshot): PersistedSnapshot {
  return {
    ...snapshot,
    blockNumber: snapshot.blockNumber.toString(),
    holdings: snapshot.holdings.map((holding) => ({ ...holding, tokenId: holding.tokenId.toString(), minerals: holding.minerals.toString() })),
    wallets: snapshot.wallets.map((wallet) => ({
      ...wallet,
      tokenIds: wallet.tokenIds.map(String),
      typeScores: wallet.typeScores.map((typeScore) => ({ ...typeScore, minerals: typeScore.minerals.toString(), multiplierBps: typeScore.multiplierBps.toString(), score: typeScore.score.toString() })),
      diversityMultiplierBps: wallet.diversityMultiplierBps.toString(),
      score: wallet.score.toString(),
    })),
  };
}

export function deserializeDailySnapshot(snapshot: PersistedSnapshot): DailySnapshot {
  return {
    ...snapshot,
    blockNumber: BigInt(snapshot.blockNumber),
    holdings: snapshot.holdings.map((holding) => ({ ...holding, holder: getAddress(holding.holder), tokenId: BigInt(holding.tokenId), minerals: BigInt(holding.minerals) })),
    wallets: snapshot.wallets.map((wallet) => ({
      ...wallet,
      holder: getAddress(wallet.holder),
      tokenIds: wallet.tokenIds.map(BigInt),
      typeScores: wallet.typeScores.map((typeScore) => ({ ...typeScore, minerals: BigInt(typeScore.minerals), multiplierBps: BigInt(typeScore.multiplierBps), score: BigInt(typeScore.score) })),
      diversityMultiplierBps: BigInt(wallet.diversityMultiplierBps),
      score: BigInt(wallet.score),
    })),
  };
}

function validateStore(value: unknown): PersistedStore {
  if (!value || typeof value !== 'object') throw new Error('Eligibility store is malformed.');
  const candidate = value as {
    version?: number;
    cursor?: string | { nextBlock: string; lastBlockHash?: Hex };
    cursorEpoch?: string;
    tickets?: Record<string, PersistedTicket>;
    vouchers?: Record<string, PersistedVoucher>;
    snapshots?: Record<string, PersistedSnapshot>;
  };
  const store = candidate.version === 1 && candidate.tickets && candidate.vouchers
    ? {
        version: 2 as const,
        cursor: typeof candidate.cursor === 'string' ? { nextBlock: candidate.cursor } : candidate.cursor,
        tickets: candidate.tickets,
        vouchers: candidate.vouchers,
        snapshots: {},
      }
    : candidate as PersistedStore;
  if (store.version !== 2 || !store.tickets || !store.vouchers || !store.snapshots) throw new Error('Eligibility store has an unsupported schema.');
  for (const ticket of Object.values(store.tickets)) {
    if (!isAddress(ticket.recipient) || !isHash(ticket.originTxHash)) throw new Error('Eligibility store contains an invalid ticket.');
    deserializeTicket(ticket);
  }
  for (const voucher of Object.values(store.vouchers)) {
    if (!isAddress(voucher.voucher.recipient) || !isHash(voucher.voucher.originTxHash)) throw new Error('Eligibility store contains an invalid voucher.');
    deserializePreparedVoucher(voucher);
  }
  for (const snapshot of Object.values(store.snapshots)) deserializeDailySnapshot(snapshot);
  return store;
}

/** Durable local JSON store. It uses atomic replacement, but a shared production deployment needs a transactional database. */
export class FileEligibilityStore implements EligibilityStore {
  public constructor(private readonly filePath: string) {}

  private async read(): Promise<PersistedStore> {
    try {
      return validateStore(JSON.parse(await readFile(this.filePath, 'utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyStore();
      throw error;
    }
  }

  private async update(mutator: (store: PersistedStore) => void): Promise<void> {
    const store = await this.read();
    mutator(store);
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(store), 'utf8');
    await rename(temporaryPath, this.filePath);
  }

  async saveTicket(ticket: IndexedTicket): Promise<void> {
    await this.update((store) => {
      const key = ticket.ticketId.toString();
      const existing = store.tickets[key];
      const serialized = serializeTicket(ticket);
      if (existing && JSON.stringify(existing) !== JSON.stringify(serialized)) throw new Error(`Ticket ${key} conflicts with existing indexed provenance.`);
      store.tickets[key] = serialized;
    });
  }

  async saveProof(proof: MegasteraProof): Promise<void> {
    const normalized = proofFromTicket(proof);
    const existing = await this.getProof({ transactionHash: normalized.originTxHash, logIndex: normalized.logIndex });
    if (existing && JSON.stringify(serializeTicket(existing)) !== JSON.stringify(serializeTicket(normalized))) {
      throw new Error(`Megastera proof ${normalized.originTxHash}:${normalized.logIndex} conflicts with existing provenance.`);
    }
    if (existing) return;
    await this.saveTicket(normalized);
  }

  async getProof(reference: MegasteraProofReference | Hex, logIndex?: bigint | number): Promise<MegasteraProof | undefined> {
    const key = proofReferenceKey(reference, logIndex);
    const store = await this.read();
    for (const persisted of Object.values(store.tickets)) {
      if (`${persisted.originTxHash.toLowerCase()}:${persisted.logIndex}` !== key) continue;
      return proofFromTicket(deserializeTicket(persisted));
    }
    return undefined;
  }

  async listProofs(recipient: Address, pagination: ProofPagination): Promise<ProofListResult> {
    const normalizedRecipient = getAddress(recipient).toLowerCase();
    const proofs = (await this.read()).tickets
      ? Object.values((await this.read()).tickets)
        .map((ticket) => proofFromTicket(deserializeTicket(ticket)))
        .filter((proof) => proof.recipient.toLowerCase() === normalizedRecipient)
        .sort((left, right) => {
          if (left.blockNumber !== right.blockNumber) return left.blockNumber > right.blockNumber ? -1 : 1;
          if (left.logIndex !== right.logIndex) return left.logIndex > right.logIndex ? -1 : 1;
          return left.ticketId > right.ticketId ? -1 : left.ticketId < right.ticketId ? 1 : 0;
        })
      : [];
    return {
      total: proofs.length,
      offset: pagination.offset,
      limit: pagination.limit,
      proofs: proofs.slice(pagination.offset, pagination.offset + pagination.limit),
    };
  }

  async getVoucher(ticketId: bigint, recipient: Address, now: bigint): Promise<PreparedVoucher | undefined> {
    const stored = (await this.read()).vouchers[voucherKey(ticketId, recipient)];
    if (!stored) return undefined;
    const prepared = deserializePreparedVoucher(stored);
    return prepared.voucher.expiresAt > now ? prepared : undefined;
  }

  async saveVoucher(prepared: PreparedVoucher): Promise<void> {
    await this.update((store) => {
      store.vouchers[voucherKey(prepared.voucher.ticketId, prepared.voucher.recipient)] = serializePreparedVoucher(prepared);
    });
  }

  async getArtifact(key: string): Promise<PlanetArtifact | undefined> {
    const value = (await this.read() as PersistedStore & { artifacts?: Record<string, PlanetArtifact> }).artifacts?.[key];
    return value ? { ...value, recipient: getAddress(value.recipient) } : undefined;
  }

  async saveArtifact(artifact: PlanetArtifact): Promise<void> {
    await this.update((store) => {
      const persisted = store as PersistedStore & { artifacts?: Record<string, PlanetArtifact> };
      persisted.artifacts ??= {};
      const existing = persisted.artifacts[artifact.key];
      if (existing && JSON.stringify(existing) !== JSON.stringify(artifact)) throw new Error(`Planet artifact ${artifact.key} conflicts with immutable content.`);
      persisted.artifacts[artifact.key] = artifact;
    });
  }

  async getCursor(): Promise<IndexerCursor | undefined> {
    const store = await this.read();
    if (store.cursorEpoch !== MEGAPLANETS_TICKET_START_BLOCK.toString()) return undefined;
    const cursor = store.cursor;
    return cursor === undefined ? undefined : { nextBlock: BigInt(cursor.nextBlock), lastBlockHash: cursor.lastBlockHash };
  }

  async setCursor(nextBlock: bigint, lastBlockHash: Hex): Promise<void> {
    await this.update((store) => {
      store.cursor = { nextBlock: nextBlock.toString(), lastBlockHash };
      store.cursorEpoch = MEGAPLANETS_TICKET_START_BLOCK.toString();
    });
  }

  async rewind(fromBlock: bigint): Promise<void> {
    await this.update((store) => {
      const removedTicketIds = new Set<string>();
      for (const [key, ticket] of Object.entries(store.tickets)) {
        if (BigInt(ticket.blockNumber) >= fromBlock) {
          removedTicketIds.add(key);
          delete store.tickets[key];
        }
      }
      for (const [key, voucher] of Object.entries(store.vouchers)) {
        if (removedTicketIds.has(voucher.voucher.ticketId)) delete store.vouchers[key];
      }
      store.cursor = undefined;
      store.cursorEpoch = MEGAPLANETS_TICKET_START_BLOCK.toString();
    });
  }

  async getSnapshot(blockNumber: bigint): Promise<DailySnapshot | undefined> {
    const snapshot = (await this.read()).snapshots[snapshotKey(blockNumber)];
    return snapshot ? deserializeDailySnapshot(snapshot) : undefined;
  }

  async saveSnapshot(snapshot: DailySnapshot): Promise<void> {
    await this.update((store) => {
      const key = snapshotKey(snapshot.blockNumber);
      if (store.snapshots[key]) throw new Error(`Snapshot ${key} already exists.`);
      store.snapshots[key] = serializeDailySnapshot(snapshot);
    });
  }
}

/** In-memory implementation for tests and serverless previews; it deliberately provides no restart durability. */
export class MemoryEligibilityStore implements EligibilityStore {
  private readonly tickets = new Map<string, IndexedTicket>();
  private readonly vouchers = new Map<string, PreparedVoucher>();
  private cursor: IndexerCursor | undefined;
  private readonly snapshots = new Map<string, DailySnapshot>();
  private readonly artifacts = new Map<string, PlanetArtifact>();

  async saveTicket(ticket: IndexedTicket) {
    const key = ticket.ticketId.toString();
    const existing = this.tickets.get(key);
    if (existing && JSON.stringify(serializeTicket(existing)) !== JSON.stringify(serializeTicket(ticket))) throw new Error(`Ticket ${key} conflicts with existing indexed provenance.`);
    this.tickets.set(key, ticket);
  }
  async saveProof(proof: MegasteraProof) {
    const normalized = proofFromTicket(proof);
    const existing = await this.getProof({ transactionHash: normalized.originTxHash, logIndex: normalized.logIndex });
    if (existing && JSON.stringify(serializeTicket(existing)) !== JSON.stringify(serializeTicket(normalized))) {
      throw new Error(`Megastera proof ${normalized.originTxHash}:${normalized.logIndex} conflicts with existing provenance.`);
    }
    if (existing) return;
    await this.saveTicket(normalized);
  }
  async getProof(reference: MegasteraProofReference | Hex, logIndex?: bigint | number) {
    const key = proofReferenceKey(reference, logIndex);
    for (const ticket of this.tickets.values()) {
      if (`${ticket.originTxHash.toLowerCase()}:${ticket.logIndex.toString()}` === key) return proofFromTicket(ticket);
    }
    return undefined;
  }
  async listProofs(recipient: Address, pagination: ProofPagination): Promise<ProofListResult> {
    const normalizedRecipient = getAddress(recipient).toLowerCase();
    const proofs = [...this.tickets.values()]
      .map(proofFromTicket)
      .filter((proof) => proof.recipient.toLowerCase() === normalizedRecipient)
      .sort((left, right) => {
        if (left.blockNumber !== right.blockNumber) return left.blockNumber > right.blockNumber ? -1 : 1;
        if (left.logIndex !== right.logIndex) return left.logIndex > right.logIndex ? -1 : 1;
        return left.ticketId > right.ticketId ? -1 : left.ticketId < right.ticketId ? 1 : 0;
      });
    return {
      total: proofs.length,
      offset: pagination.offset,
      limit: pagination.limit,
      proofs: proofs.slice(pagination.offset, pagination.offset + pagination.limit),
    };
  }
  async getVoucher(ticketId: bigint, recipient: Address, now: bigint) {
    const voucher = this.vouchers.get(voucherKey(ticketId, recipient));
    return voucher && voucher.voucher.expiresAt > now ? voucher : undefined;
  }
  async saveVoucher(prepared: PreparedVoucher) { this.vouchers.set(voucherKey(prepared.voucher.ticketId, prepared.voucher.recipient), prepared); }
  async getArtifact(key: string) { return this.artifacts.get(key); }
  async saveArtifact(artifact: PlanetArtifact) {
    const existing = this.artifacts.get(artifact.key);
    if (existing && JSON.stringify(existing) !== JSON.stringify(artifact)) throw new Error(`Planet artifact ${artifact.key} conflicts with immutable content.`);
    this.artifacts.set(artifact.key, artifact);
  }
  async getCursor() { return this.cursor; }
  async setCursor(nextBlock: bigint, lastBlockHash: Hex) { this.cursor = { nextBlock, lastBlockHash }; }
  async rewind(fromBlock: bigint) {
    const removedTicketIds = new Set<string>();
    for (const [key, ticket] of this.tickets) {
      if (ticket.blockNumber >= fromBlock) {
        removedTicketIds.add(key);
        this.tickets.delete(key);
      }
    }
    for (const [key, voucher] of this.vouchers) {
      if (removedTicketIds.has(voucher.voucher.ticketId.toString())) this.vouchers.delete(key);
    }
    this.cursor = undefined;
  }
  async getSnapshot(blockNumber: bigint) { return this.snapshots.get(snapshotKey(blockNumber)); }
  async saveSnapshot(snapshot: DailySnapshot) {
    const key = snapshotKey(snapshot.blockNumber);
    if (this.snapshots.has(key)) throw new Error(`Snapshot ${key} already exists.`);
    this.snapshots.set(key, snapshot);
  }
}
