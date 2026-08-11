import { useMemo } from 'react';
import { parseAbi } from 'viem';
import { useReadContracts } from 'wagmi';
import { JACKPOT_ADDRESS } from '@/config/contracts';
import type { DrawingState } from '@/hooks/useJackpotState';
import type { RoundStatus } from '@/lib/api';

const THIRTY_SECONDS = 30_000;
const drawingStateAbi = parseAbi([
  'function getDrawingState(uint256 _drawingId) view returns ((uint256 prizePool, uint256 ticketPrice, uint256 edgePerTicket, uint256 referralWinShare, uint256 referralFee, uint256 globalTicketsBought, uint256 lpEarnings, uint256 drawingTime, uint256 winningTicket, uint8 ballMax, uint8 bonusballMax, address payoutCalculator, bool jackpotLock))',
]);

export function drawingStatusLabel(status: RoundStatus | undefined) {
  if (status === 'active') return 'DRAWING ACTIVE';
  if (status === 'settled') return 'DRAWING SETTLED';
  return 'DRAWING STATUS UNAVAILABLE';
}

/** Reads canonical Base Sepolia lifecycle state for ticket-linked drawings. */
export function usePlanetDrawingStates(drawingIds: readonly bigint[]) {
  const uniqueDrawingIds = useMemo(
    () => [...new Set(drawingIds.map((drawingId) => drawingId.toString()))],
    [drawingIds],
  );
  const contracts = useMemo(() => uniqueDrawingIds.map((drawingId) => ({
    address: JACKPOT_ADDRESS,
    abi: drawingStateAbi,
    functionName: 'getDrawingState' as const,
    args: [BigInt(drawingId)] as const,
  })), [uniqueDrawingIds]);
  const query = useReadContracts({
    contracts,
    query: {
      enabled: contracts.length > 0,
      staleTime: THIRTY_SECONDS,
      refetchInterval: THIRTY_SECONDS,
    },
  });
  const states = useMemo(() => {
    const result = new Map<string, RoundStatus>();
    uniqueDrawingIds.forEach((drawingId, index) => {
      const read = query.data?.[index];
      if (read?.status !== 'success') return;
      const drawing = read.result as { winningTicket: bigint };
      result.set(drawingId, drawing.winningTicket === 0n ? 'active' : 'settled');
    });
    return result;
  }, [query.data, uniqueDrawingIds]);
  const details = useMemo(() => {
    const result = new Map<string, DrawingState>();
    uniqueDrawingIds.forEach((drawingId, index) => {
      const read = query.data?.[index];
      if (read?.status !== 'success') return;
      result.set(drawingId, read.result as DrawingState);
    });
    return result;
  }, [query.data, uniqueDrawingIds]);

  return {
    states,
    details,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
