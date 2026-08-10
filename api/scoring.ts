import { getAddress, type Address, type Hex } from 'viem';

export type PlanetHolding = {
  holder: Address;
  tokenId: bigint;
  planetType: string;
  minerals: bigint;
};

export type TypeScore = {
  planetType: string;
  tokenCount: number;
  minerals: bigint;
  multiplierBps: bigint;
  score: bigint;
};

export type WalletSnapshot = {
  holder: Address;
  tokenIds: readonly bigint[];
  typeScores: readonly TypeScore[];
  diversityMultiplierBps: bigint;
  score: bigint;
};

export type DailySnapshot = {
  seasonId: Hex;
  blockNumber: bigint;
  capturedAt: string;
  holdings: readonly PlanetHolding[];
  wallets: readonly WalletSnapshot[];
};

const BASIS_POINTS = 10_000n;

function typeMultiplierBps(tokenCount: number): bigint {
  if (tokenCount <= 2) return 10_000n;
  if (tokenCount <= 5) return 11_500n;
  if (tokenCount <= 8) return 14_000n;
  if (tokenCount <= 11) return 18_000n;
  return 23_000n;
}

function diversityMultiplierBps(typeCount: number): bigint {
  if (typeCount <= 1) return 10_000n;
  if (typeCount >= 10) return 11_000n;
  return 10_000n + BigInt(typeCount - 1) * 100n;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Produces a deterministic, auditable score for one wallet's immutable Planet holdings. */
export function scoreWalletHoldings(holder: Address, holdings: readonly PlanetHolding[]): WalletSnapshot {
  const normalizedHolder = getAddress(holder);
  const byType = new Map<string, PlanetHolding[]>();

  for (const holding of holdings) {
    if (getAddress(holding.holder) !== normalizedHolder) throw new Error('Holding owner does not match snapshot wallet.');
    if (!holding.planetType.trim()) throw new Error('Planet Type is required for scoring.');
    if (holding.minerals < 0n) throw new Error('Planet minerals cannot be negative.');
    const entries = byType.get(holding.planetType) ?? [];
    entries.push(holding);
    byType.set(holding.planetType, entries);
  }

  const typeScores = [...byType.entries()]
    .map(([planetType, entries]) => {
      const minerals = entries.reduce((total, entry) => total + entry.minerals, 0n);
      const multiplierBps = typeMultiplierBps(entries.length);
      return {
        planetType,
        tokenCount: entries.length,
        minerals,
        multiplierBps,
        score: (minerals * multiplierBps) / BASIS_POINTS,
      };
    })
    .sort((left, right) => compareText(left.planetType, right.planetType));
  const diversityMultiplier = diversityMultiplierBps(typeScores.length);
  const typeTotal = typeScores.reduce((total, entry) => total + entry.score, 0n);

  return {
    holder: normalizedHolder,
    tokenIds: holdings.map((holding) => holding.tokenId).sort((left, right) => (left < right ? -1 : 1)),
    typeScores,
    diversityMultiplierBps: diversityMultiplier,
    score: (typeTotal * diversityMultiplier) / BASIS_POINTS,
  };
}

/** Creates a sorted snapshot report and rejects duplicate token IDs before scores are calculated. */
export function createDailySnapshot(input: {
  seasonId: Hex;
  blockNumber: bigint;
  capturedAt: string;
  holdings: readonly PlanetHolding[];
}): DailySnapshot {
  if (input.blockNumber < 0n) throw new Error('Snapshot block number cannot be negative.');
  if (!input.capturedAt.trim()) throw new Error('Snapshot capture time is required.');

  const tokenIds = new Set<string>();
  const byHolder = new Map<Address, PlanetHolding[]>();
  for (const holding of input.holdings) {
    const tokenId = holding.tokenId.toString();
    if (tokenIds.has(tokenId)) throw new Error(`Duplicate Planet token ID ${tokenId} in snapshot.`);
    tokenIds.add(tokenId);
    const holder = getAddress(holding.holder);
    const entries = byHolder.get(holder) ?? [];
    entries.push({ ...holding, holder });
    byHolder.set(holder, entries);
  }

  return {
    seasonId: input.seasonId,
    blockNumber: input.blockNumber,
    capturedAt: input.capturedAt,
    holdings: [...input.holdings].sort((left, right) => (left.tokenId < right.tokenId ? -1 : left.tokenId > right.tokenId ? 1 : 0)),
    wallets: [...byHolder.entries()]
      .map(([holder, holdings]) => scoreWalletHoldings(holder, holdings))
      .sort((left, right) => compareText(left.holder.toLowerCase(), right.holder.toLowerCase())),
  };
}
