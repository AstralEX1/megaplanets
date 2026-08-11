// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => ({
  data: [] as Array<{ status: 'success' | 'failure'; result?: {
    winningTicket: bigint;
    prizePool?: bigint;
    referralWinShare?: bigint;
  } }>,
  error: undefined as Error | undefined,
  isLoading: false,
}));

vi.mock('wagmi', () => ({
  useReadContracts: () => rpc,
}));
vi.mock('@tanstack/react-query', () => ({
  useQueries: () => {
    throw new Error('Base Sepolia drawing status must not depend on the historical Data API.');
  },
}));

import { usePlanetDrawingStates } from './usePlanetDrawingStates';

describe('usePlanetDrawingStates', () => {
  beforeEach(() => {
    rpc.data = [];
    rpc.error = undefined;
    rpc.isLoading = false;
  });

  it('maps Base Sepolia drawing contract state to active and settled statuses', () => {
    rpc.data = [
      { status: 'success', result: { winningTicket: 0n, prizePool: 10n, referralWinShare: 1n } },
      { status: 'success', result: { winningTicket: 42n, prizePool: 20n, referralWinShare: 2n } },
    ];

    const { result } = renderHook(() => usePlanetDrawingStates([7262n, 7263n, 7262n]));

    expect([...result.current.states]).toEqual([
      ['7262', 'active'],
      ['7263', 'settled'],
    ]);
    expect(result.current.details.get('7263')).toEqual(expect.objectContaining({
      winningTicket: 42n,
      prizePool: 20n,
      referralWinShare: 2n,
    }));
    expect(result.current.error).toBeUndefined();
  });

  it('leaves an individual failed drawing unavailable without hiding successful statuses', () => {
    rpc.data = [
      { status: 'failure' },
      { status: 'success', result: { winningTicket: 7n } },
    ];

    const { result } = renderHook(() => usePlanetDrawingStates([7396n, 7399n]));

    expect(result.current.states.get('7396')).toBeUndefined();
    expect(result.current.states.get('7399')).toBe('settled');
  });
});
