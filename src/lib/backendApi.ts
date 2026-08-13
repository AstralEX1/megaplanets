import { type Address, getAddress, type Hex, isAddress, isHash } from 'viem';

/** One base URL for the Planet, mining, leaderboard, and voucher services. */
const configuredBase = (
  import.meta.env.VITE_BACKEND_API_BASE_URL ?? import.meta.env.VITE_PLANET_API_BASE_URL
)?.trim();

export const BACKEND_API_BASE_URL = configuredBase ?? '';

export function backendApiUrl(path: string, base = BACKEND_API_BASE_URL): string {
  if (!path.startsWith('/')) throw new Error('Backend API paths must start with /.');
  if (!base) return path;
  return new URL(path, base.endsWith('/') ? base : `${base}/`).toString();
}

export function backendApiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = backendApiUrl(path);
  return init === undefined ? fetch(url) : fetch(url, init);
}

/** Serialized, receipt-verified server proof used to recover old reveal candidates. */
export type SerializedMegasteraProof = {
  recipient: Address;
  ticketId: string;
  drawingId: string;
  normals: number[];
  bonusBall: number;
  originTxHash: Hex;
  blockNumber: string;
  blockHash?: Hex;
  logIndex: string;
  purchasedAt?: string;
  chainId: number;
  jackpotAddress: Address;
  source: Hex;
};

export type MegasteraProofPage = {
  proofs: SerializedMegasteraProof[];
  total: number;
  offset: number;
  limit: number;
};

function parseMegasteraProofPage(value: unknown): MegasteraProofPage {
  if (!value || typeof value !== 'object')
    throw new Error('Megastera proof response is malformed.');
  const page = value as Partial<MegasteraProofPage>;
  if (
    !Array.isArray(page.proofs) ||
    !Number.isSafeInteger(page.total) ||
    !Number.isSafeInteger(page.offset) ||
    !Number.isSafeInteger(page.limit)
  ) {
    throw new Error('Megastera proof response is malformed.');
  }
  const rawProofs = page.proofs;
  const total = page.total;
  const offset = page.offset;
  const limit = page.limit;
  if (
    typeof total !== 'number' ||
    typeof offset !== 'number' ||
    typeof limit !== 'number' ||
    !Number.isSafeInteger(total) ||
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(limit) ||
    total < 0 ||
    offset < 0 ||
    limit < 1 ||
    limit > 100
  ) {
    throw new Error('Megastera proof response is malformed.');
  }
  const proofs = rawProofs.map((proof) => {
    if (!proof || typeof proof !== 'object')
      throw new Error('Megastera proof response is malformed.');
    const candidate = proof as Partial<SerializedMegasteraProof>;
    if (
      !isAddress(candidate.recipient ?? '') ||
      !isAddress(candidate.jackpotAddress ?? '') ||
      !isHash(candidate.originTxHash ?? '') ||
      !isHash(candidate.source ?? '') ||
      (candidate.blockHash !== undefined && !isHash(candidate.blockHash)) ||
      !Array.isArray(candidate.normals) ||
      typeof candidate.ticketId !== 'string' ||
      typeof candidate.drawingId !== 'string' ||
      typeof candidate.blockNumber !== 'string' ||
      typeof candidate.logIndex !== 'string' ||
      typeof candidate.bonusBall !== 'number' ||
      typeof candidate.chainId !== 'number'
    ) {
      throw new Error('Megastera proof response is malformed.');
    }
    const recipient = candidate.recipient;
    const jackpotAddress = candidate.jackpotAddress;
    if (!recipient || !jackpotAddress) throw new Error('Megastera proof response is malformed.');
    return {
      ...candidate,
      recipient: getAddress(recipient),
      jackpotAddress: getAddress(jackpotAddress),
    } as SerializedMegasteraProof;
  });
  return { proofs, total, offset, limit };
}

/** Reads one bounded page of durable server-side Megastera Proof history. */
export async function fetchMegasteraProofPage(
  recipient: Address,
  options: { offset?: number; limit?: number; signal?: AbortSignal } = {},
): Promise<MegasteraProofPage> {
  const offset = options.offset ?? 0;
  const limit = options.limit ?? 100;
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new Error('Megastera proof pagination is invalid.');
  }
  const path = `/api/planets/megastera-proofs?recipient=${encodeURIComponent(getAddress(recipient))}&offset=${offset}&limit=${limit}`;
  const response = await backendApiFetch(path, { signal: options.signal });
  const payload = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : `Megastera proof lookup returned HTTP ${response.status}.`;
    throw new Error(message);
  }
  return parseMegasteraProofPage(payload);
}
