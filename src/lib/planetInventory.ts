import type { PlanetPreview, PlanetRarity } from '@megaplanets/planet-generator';
import type { RoundStatus } from './api';

export type PlanetSort = 'newest' | 'oldest' | 'minerals' | 'rarity';

export type PlanetInventoryItem = {
  preview: PlanetPreview;
  ticketId: string;
  drawingId: string;
  tokenId?: string;
  mintedAt?: string;
  revealed: boolean;
};

const RARITY_RANK: Record<PlanetRarity, number> = {
  Common: 0,
  Uncommon: 1,
  Epic: 2,
  Legendary: 3,
};

function compareOptionalTime(left: string | undefined, right: string | undefined, direction: 1 | -1) {
  if (left === undefined && right === undefined) return 0;
  if (left === undefined) return 1;
  if (right === undefined) return -1;
  return (Date.parse(left) - Date.parse(right)) * direction;
}

function compareTicketId(left: PlanetInventoryItem, right: PlanetInventoryItem) {
  const leftId = BigInt(left.ticketId);
  const rightId = BigInt(right.ticketId);
  return leftId === rightId ? 0 : leftId > rightId ? -1 : 1;
}

export function sortPlanetInventory(
  items: readonly PlanetInventoryItem[],
  sort: PlanetSort,
): PlanetInventoryItem[] {
  return [...items].sort((left, right) => {
    if (sort === 'newest' || sort === 'oldest') {
      return compareOptionalTime(left.mintedAt, right.mintedAt, sort === 'newest' ? -1 : 1) || compareTicketId(left, right);
    }
    if (left.revealed !== right.revealed) return left.revealed ? -1 : 1;
    if (!left.revealed) return compareTicketId(left, right);
    if (sort === 'minerals') {
      return right.preview.descriptor.traits.minerals - left.preview.descriptor.traits.minerals || compareTicketId(left, right);
    }
    return RARITY_RANK[right.preview.descriptor.traits.rarity] - RARITY_RANK[left.preview.descriptor.traits.rarity]
      || right.preview.descriptor.traits.minerals - left.preview.descriptor.traits.minerals
      || compareTicketId(left, right);
  });
}

export function sumMineralsPerDay(items: readonly PlanetInventoryItem[]) {
  return items.reduce(
    (total, item) => total + (item.revealed ? item.preview.descriptor.traits.minerals : 0),
    0,
  );
}

export function rarityBorderClass(rarity: PlanetRarity) {
  switch (rarity) {
    case 'Common':
      return 'border-zinc-500';
    case 'Uncommon':
      return 'border-emerald-400';
    case 'Epic':
      return 'border-violet-400';
    case 'Legendary':
      return 'border-amber-300';
  }
}

function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3_600);
  const minutes = Math.floor((safeSeconds % 3_600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds].map((value) => value.toString().padStart(2, '0')).join(':');
}

export function getCycleAction({
  selectedDrawingId,
  currentDrawingId,
  historicalStatus,
  phase,
  drawingTime,
  nowMs,
}: {
  selectedDrawingId: bigint;
  currentDrawingId?: bigint;
  historicalStatus?: RoundStatus;
  phase?: 'open' | 'awaiting' | 'settling' | 'settled' | 'unlocked';
  drawingTime?: bigint;
  nowMs: number;
}) {
  const isCurrent = currentDrawingId !== undefined && selectedDrawingId === currentDrawingId;
  if (isCurrent && phase === 'open' && drawingTime !== undefined) {
    const secondsRemaining = Math.max(0, Number(drawingTime) - Math.floor(nowMs / 1_000));
    return { label: `Cycle ends in ${formatCountdown(secondsRemaining)}`, enabled: true } as const;
  }
  if (isCurrent && (phase === 'awaiting' || phase === 'settling' || phase === 'unlocked')) {
    return { label: 'Drawing in progress', enabled: true } as const;
  }
  if ((isCurrent && phase === 'settled') || historicalStatus === 'settled') {
    return { label: 'View results', enabled: true } as const;
  }
  if (historicalStatus === 'active') {
    return { label: 'Drawing in progress', enabled: true } as const;
  }
  return { label: 'Drawing status unavailable', enabled: false } as const;
}
