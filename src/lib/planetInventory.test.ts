import type { PlanetPreview } from '@megaplanets/planet-generator';
import { describe, expect, it } from 'vitest';
import {
  getCycleAction,
  rarityBorderClass,
  sortPlanetInventory,
  sumMineralsPerDay,
  type PlanetInventoryItem,
} from './planetInventory';

function item({
  ticketId,
  tokenId,
  minerals,
  rarity,
  mintedAt,
  revealed = true,
}: {
  ticketId: bigint;
  tokenId?: string;
  minerals: number;
  rarity: 'Common' | 'Uncommon' | 'Epic' | 'Legendary';
  mintedAt?: string;
  revealed?: boolean;
}): PlanetInventoryItem {
  return {
    preview: {
      descriptor: {
        input: { ticketId, drawingId: 218n },
        traits: { minerals, rarity },
      },
    } as unknown as PlanetPreview,
    ticketId: ticketId.toString(),
    drawingId: '218',
    tokenId,
    mintedAt,
    revealed,
  };
}

describe('planet inventory view model', () => {
  const common = item({ ticketId: 1n, tokenId: '11', minerals: 15, rarity: 'Common', mintedAt: '2026-08-01T00:00:00.000Z' });
  const epic = item({ ticketId: 2n, tokenId: '12', minerals: 120, rarity: 'Epic', mintedAt: '2026-08-03T00:00:00.000Z' });
  const legendary = item({ ticketId: 3n, tokenId: '13', minerals: 200, rarity: 'Legendary', mintedAt: '2026-08-02T00:00:00.000Z' });

  it('sorts by minted time, minerals, and rarity without mutating the source array', () => {
    const source = [common, epic, legendary];

    expect(sortPlanetInventory(source, 'newest').map((entry) => entry.ticketId)).toEqual(['2', '3', '1']);
    expect(sortPlanetInventory(source, 'oldest').map((entry) => entry.ticketId)).toEqual(['1', '3', '2']);
    expect(sortPlanetInventory(source, 'minerals').map((entry) => entry.ticketId)).toEqual(['3', '2', '1']);
    expect(sortPlanetInventory(source, 'rarity').map((entry) => entry.ticketId)).toEqual(['3', '2', '1']);
    expect(source.map((entry) => entry.ticketId)).toEqual(['1', '2', '3']);
  });

  it('keeps unrevealed tickets after revealed planets for trait-based sorting', () => {
    const unrevealed = item({ ticketId: 99n, minerals: 320, rarity: 'Legendary', revealed: false });

    expect(sortPlanetInventory([unrevealed, common], 'minerals').map((entry) => entry.ticketId)).toEqual(['1', '99']);
    expect(sortPlanetInventory([unrevealed, common], 'rarity').map((entry) => entry.ticketId)).toEqual(['1', '99']);
  });

  it('totals minerals from revealed planets only', () => {
    const unrevealed = item({ ticketId: 99n, minerals: 320, rarity: 'Legendary', revealed: false });
    expect(sumMineralsPerDay([common, epic, unrevealed])).toBe(135);
  });

  it('maps every rarity to a stable border color class', () => {
    expect(rarityBorderClass('Common')).toContain('border-zinc');
    expect(rarityBorderClass('Uncommon')).toContain('border-emerald');
    expect(rarityBorderClass('Epic')).toContain('border-violet');
    expect(rarityBorderClass('Legendary')).toContain('border-amber');
  });

  it('derives the primary cycle action from live current-drawing state', () => {
    expect(getCycleAction({ selectedDrawingId: 218n, currentDrawingId: 218n, phase: 'open', drawingTime: 1_000n, nowMs: 999_000 })).toEqual({ label: 'Cycle ends in 00:00:01', enabled: true });
    expect(getCycleAction({ selectedDrawingId: 218n, currentDrawingId: 218n, phase: 'settling', drawingTime: 1_000n, nowMs: 999_000 })).toEqual({ label: 'Drawing in progress', enabled: true });
  });

  it('uses historical drawing status when the selected drawing is not current', () => {
    expect(getCycleAction({ selectedDrawingId: 217n, currentDrawingId: 218n, historicalStatus: 'settled', phase: 'open', drawingTime: 1_000n, nowMs: 999_000 })).toEqual({ label: 'View results', enabled: true });
    expect(getCycleAction({ selectedDrawingId: 217n, currentDrawingId: 218n, historicalStatus: undefined, phase: 'open', drawingTime: 1_000n, nowMs: 999_000 })).toEqual({ label: 'Drawing status unavailable', enabled: false });
  });
});
