import { useEffect, useMemo, useState } from 'react';
import { parseAbi } from 'viem';
import { useReadContracts } from 'wagmi';
import { JACKPOT_ADDRESS } from '@/config/contracts';
import type { LifecyclePhase } from '@/hooks/useJackpotState';
import { usePlanetDrawingStates } from '@/hooks/usePlanetDrawingStates';
import { useWalletTickets } from '@/hooks/useWalletTickets';
import type { RoundStatus, Ticket } from '@/lib/api';

export type PlanetTicketRef = {
  ticketId: string;
  drawingId: string;
};

export type PlanetTicketStatus =
  | { kind: 'countdown'; time: string }
  | { kind: 'drawing' }
  | { kind: 'claim'; amount: bigint; ticketId: bigint }
  | { kind: 'claimed'; amount: bigint }
  | { kind: 'drawn' }
  | { kind: 'unavailable' };

type StatusInput = PlanetTicketRef & {
  currentDrawingId?: bigint;
  phase?: LifecyclePhase;
  drawingTime?: bigint;
  nowMs: number;
  drawingStatus?: RoundStatus;
  apiTicket?: Ticket;
  onChainOutcome?: PlanetTicketOutcome;
};

export type PlanetTicketOutcome = {
  tierId: number;
  amount: bigint;
};

const ONE_E18 = 1_000_000_000_000_000_000n;
const outcomeAbi = parseAbi([
  'function getTicketTierIds(uint256[] _ticketIds) view returns (uint256[] tierIds)',
  'function getDrawingTierPayouts(uint256 _drawingId) view returns (uint256[12])',
]);

function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3_600);
  const minutes = Math.floor((safeSeconds % 3_600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds].map((value) => value.toString().padStart(2, '0')).join(':');
}

export function derivePlanetTicketStatus({
  ticketId,
  drawingId,
  currentDrawingId,
  phase,
  drawingTime,
  nowMs,
  drawingStatus,
  apiTicket,
  onChainOutcome,
}: StatusInput): PlanetTicketStatus {
  if (apiTicket?.matched_normals !== null && apiTicket?.matched_normals !== undefined) {
    const amount = apiTicket.winnings_amount ? BigInt(apiTicket.winnings_amount.amount) : 0n;
    if (amount > 0n) {
      return apiTicket.claimed
        ? { kind: 'claimed', amount }
        : { kind: 'claim', amount, ticketId: BigInt(ticketId) };
    }
    return { kind: 'drawn' };
  }

  if (onChainOutcome) {
    return onChainOutcome.amount > 0n
      ? { kind: 'claim', amount: onChainOutcome.amount, ticketId: BigInt(ticketId) }
      : { kind: 'drawn' };
  }

  const isCurrent = currentDrawingId !== undefined && BigInt(drawingId) === currentDrawingId;
  if (isCurrent && phase === 'open' && drawingTime !== undefined) {
    const remaining = Number(drawingTime) - Math.floor(nowMs / 1_000);
    if (remaining > 0) return { kind: 'countdown', time: formatCountdown(remaining) };
    return { kind: 'drawing' };
  }
  if (isCurrent && (phase === 'awaiting' || phase === 'settling' || phase === 'unlocked')) {
    return { kind: 'drawing' };
  }
  if (drawingStatus === 'active') return { kind: 'drawing' };
  return { kind: 'unavailable' };
}

export function usePlanetTicketStatuses(
  address: `0x${string}` | undefined,
  ticketRefs: readonly PlanetTicketRef[],
  jackpot: { drawingId?: bigint; phase?: LifecyclePhase; drawingTime?: bigint },
) {
  const drawingStates = usePlanetDrawingStates(ticketRefs.map((ticket) => BigInt(ticket.drawingId)));
  const walletTickets = useWalletTickets(address, { pageSize: 100 });
  const settledTickets = useMemo(
    () => ticketRefs.filter((ticket) => drawingStates.states.get(ticket.drawingId) === 'settled'),
    [drawingStates.states, ticketRefs],
  );
  const settledDrawingIds = useMemo(
    () => [...new Set(settledTickets.map((ticket) => ticket.drawingId))],
    [settledTickets],
  );
  const outcomeContracts = useMemo(() => [
    ...settledTickets.map((ticket) => ({
      address: JACKPOT_ADDRESS,
      abi: outcomeAbi,
      functionName: 'getTicketTierIds' as const,
      args: [[BigInt(ticket.ticketId)]] as const,
    })),
    ...settledDrawingIds.map((drawingId) => ({
      address: JACKPOT_ADDRESS,
      abi: outcomeAbi,
      functionName: 'getDrawingTierPayouts' as const,
      args: [BigInt(drawingId)] as const,
    })),
  ], [settledDrawingIds, settledTickets]);
  const outcomeReads = useReadContracts({
    contracts: outcomeContracts,
    query: {
      enabled: outcomeContracts.length > 0,
      staleTime: Number.POSITIVE_INFINITY,
    },
  });
  const shouldTick = jackpot.phase === 'open' && ticketRefs.some(
    (ticket) => jackpot.drawingId !== undefined && BigInt(ticket.drawingId) === jackpot.drawingId,
  );
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!shouldTick) return;
    const interval = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [shouldTick]);

  const ticketsById = useMemo(
    () => new Map(walletTickets.tickets.map((ticket) => [ticket.user_ticket_id, ticket] as const)),
    [walletTickets.tickets],
  );
  const onChainOutcomes = useMemo(() => {
    const payoutsByDrawing = new Map<string, readonly bigint[]>();
    settledDrawingIds.forEach((drawingId, drawingIndex) => {
      const read = outcomeReads.data?.[settledTickets.length + drawingIndex];
      if (read?.status === 'success') payoutsByDrawing.set(drawingId, read.result as readonly bigint[]);
    });

    const outcomes = new Map<string, PlanetTicketOutcome>();
    settledTickets.forEach((ticket, ticketIndex) => {
      const tierRead = outcomeReads.data?.[ticketIndex];
      const payouts = payoutsByDrawing.get(ticket.drawingId);
      if (tierRead?.status !== 'success' || !payouts) return;
      const tierId = Number((tierRead.result as readonly bigint[])[0]);
      const grossAmount = payouts[tierId];
      if (grossAmount === undefined) return;
      const referralWinShare = drawingStates.details.get(ticket.drawingId)?.referralWinShare ?? 0n;
      const amount = (grossAmount * (ONE_E18 - referralWinShare)) / ONE_E18;
      outcomes.set(ticket.ticketId, { tierId, amount });
    });
    return outcomes;
  }, [drawingStates.details, outcomeReads.data, settledDrawingIds, settledTickets]);
  const statuses = useMemo(() => new Map(ticketRefs.map((ticket) => [ticket.ticketId, derivePlanetTicketStatus({
    ...ticket,
    currentDrawingId: jackpot.drawingId,
    phase: jackpot.phase,
    drawingTime: jackpot.drawingTime,
    nowMs,
    drawingStatus: drawingStates.states.get(ticket.drawingId),
    apiTicket: ticketsById.get(ticket.ticketId),
    onChainOutcome: onChainOutcomes.get(ticket.ticketId),
  })])), [drawingStates.states, jackpot.drawingId, jackpot.drawingTime, jackpot.phase, nowMs, onChainOutcomes, ticketRefs, ticketsById]);

  return {
    statuses,
    isLoading: drawingStates.isLoading || outcomeReads.isLoading || walletTickets.isLoading,
    error: drawingStates.error ?? outcomeReads.error ?? walletTickets.error,
    refetch: async () => {
      await Promise.all([drawingStates.refetch(), outcomeReads.refetch(), walletTickets.refetch()]);
    },
  };
}
