import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
  useWriteContract,
} from 'wagmi';
import {
  BATCH_PURCHASE_FACILITATOR_ADDRESS,
  REFERRAL_SPLIT_FULL,
  REFERRER_ADDRESS,
  TICKET_SOURCE,
} from '@/config/contracts';
import { API_BASE_URL, QK } from '@/lib/api';
import {
  batchOrderAbi,
  clearPersistedBulkOrder,
  type PersistedBulkOrder,
  persistBulkOrder,
  readCreatedBulkOrder,
  readPersistedBulkOrder,
} from '@/lib/bulkOrder';
import {
  type PurchasedTicket,
  persistPurchasedTickets,
  readPurchasedTickets,
} from '@/lib/purchaseReceipt';
import type { CustomTicket } from '@/lib/tickets';

const MAX_STATIC_BULK_TICKETS = 10;

export type BulkOrderDraft = {
  dynamicCount: number;
  staticTickets: readonly CustomTicket[];
};

export type BatchProgress = {
  ticketsExecuted: bigint;
  remainingTickets: bigint;
  remainingUSDC: bigint;
};

function isValidDraft(draft: BulkOrderDraft | null): draft is BulkOrderDraft {
  if (!draft || !Number.isSafeInteger(draft.dynamicCount) || draft.dynamicCount < 0) return false;
  if (draft.staticTickets.length > MAX_STATIC_BULK_TICKETS) return false;
  return draft.dynamicCount + draft.staticTickets.length > 0;
}

/** Keeper-executed Megapot checkout for 11+ ticket orders. */
export function useBulkPurchase(draft: BulkOrderDraft | null) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [confirmedTickets, setConfirmedTickets] = useState<readonly PurchasedTicket[]>([]);
  const [createdOrder, setCreatedOrder] = useState<PersistedBulkOrder | null>(null);
  const [provenanceError, setProvenanceError] = useState<Error | null>(null);
  const [submissionError, setSubmissionError] = useState<Error | null>(null);
  const [cancellationError, setCancellationError] = useState<Error | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);

  const minimum = useReadContract({
    address: BATCH_PURCHASE_FACILITATOR_ADDRESS,
    abi: batchOrderAbi,
    functionName: 'minimumTicketCount',
  });
  const activeOrder = useReadContract({
    address: BATCH_PURCHASE_FACILITATOR_ADDRESS,
    abi: batchOrderAbi,
    functionName: 'hasActiveBatchOrder',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 5_000 },
  });
  const orderInfo = useReadContract({
    address: BATCH_PURCHASE_FACILITATOR_ADDRESS,
    abi: batchOrderAbi,
    functionName: 'getBatchOrderInfo',
    args: address && activeOrder.data === true ? [address] : undefined,
    query: {
      enabled: !!address && activeOrder.data === true,
      retry: false,
      refetchInterval: 5_000,
    },
  });

  const createArgs = useMemo(
    () =>
      address && isValidDraft(draft)
        ? ([
            address,
            BigInt(draft.dynamicCount),
            draft.staticTickets.map((ticket) => ({
              normals: ticket.normals,
              bonusball: ticket.bonusball,
            })),
            [REFERRER_ADDRESS],
            [...REFERRAL_SPLIT_FULL],
            TICKET_SOURCE,
          ] as const)
        : undefined,
    [address, draft],
  );

  const create = useWriteContract();
  const createReceipt = useWaitForTransactionReceipt({ hash: create.data });
  const cancel = useWriteContract();
  const cancelReceipt = useWaitForTransactionReceipt({ hash: cancel.data });

  const invalidateWalletData = useCallback(() => {
    for (const resource of [
      QK.walletTicketsByRound,
      QK.walletTickets,
      QK.walletStats,
      QK.walletWins,
    ]) {
      queryClient.invalidateQueries({ queryKey: [QK.NS, API_BASE_URL, resource] });
    }
  }, [queryClient]);

  useEffect(() => {
    if (!address) {
      setCreatedOrder(null);
      return;
    }
    setCreatedOrder(readPersistedBulkOrder(address));
  }, [address]);

  useEffect(() => {
    if (!createReceipt.data || !address) return;
    try {
      const order = readCreatedBulkOrder(createReceipt.data, address);
      persistBulkOrder(address, order);
      setCreatedOrder(order);
      setProvenanceError(null);
      activeOrder.refetch();
      orderInfo.refetch();
    } catch (error) {
      setProvenanceError(
        error instanceof Error ? error : new Error('Batch order provenance failed.'),
      );
    }
  }, [createReceipt.data, address, activeOrder, orderInfo]);

  useEffect(() => {
    if (!cancelReceipt.isSuccess || !address) return;
    clearPersistedBulkOrder(address);
    setCreatedOrder(null);
    setProgress(null);
    activeOrder.refetch();
    orderInfo.refetch();
  }, [cancelReceipt.isSuccess, address, activeOrder, orderInfo]);

  const processExecution = useCallback(
    async (transactionHash: `0x${string}` | null | undefined) => {
      if (!address || !publicClient || !transactionHash) return;
      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: transactionHash });
        const tickets = readPurchasedTickets(receipt, address);
        persistPurchasedTickets(address, tickets);
        setConfirmedTickets((current) => {
          const byId = new Map(current.map((ticket) => [ticket.ticketId.toString(), ticket]));
          for (const ticket of tickets) byId.set(ticket.ticketId.toString(), ticket);
          return [...byId.values()].sort((left, right) =>
            left.ticketId < right.ticketId ? -1 : left.ticketId > right.ticketId ? 1 : 0,
          );
        });
        setProvenanceError(null);
        invalidateWalletData();
      } catch (error) {
        setProvenanceError(
          error instanceof Error ? error : new Error('Bulk ticket provenance failed.'),
        );
      }
    },
    [address, publicClient, invalidateWalletData],
  );

  useWatchContractEvent({
    address: BATCH_PURCHASE_FACILITATOR_ADDRESS,
    abi: batchOrderAbi,
    eventName: 'BatchOrderExecuted',
    args: address ? { user: address } : undefined,
    onLogs: (logs) => {
      for (const log of logs) {
        const event = log.args as {
          ticketsExecuted?: bigint;
          remainingTickets?: bigint;
          remainingUSDC?: bigint;
        };
        if (
          event.ticketsExecuted !== undefined &&
          event.remainingTickets !== undefined &&
          event.remainingUSDC !== undefined
        ) {
          setProgress({
            ticketsExecuted: event.ticketsExecuted,
            remainingTickets: event.remainingTickets,
            remainingUSDC: event.remainingUSDC,
          });
          if (event.remainingTickets === 0n && address) {
            clearPersistedBulkOrder(address);
            setCreatedOrder(null);
          }
        }
        void processExecution(log.transactionHash);
      }
      activeOrder.refetch();
      orderInfo.refetch();
    },
    poll: true,
  });

  const createOrder = async () => {
    if (!address || !publicClient || !createArgs || activeOrder.data === true || isPreparing)
      return;
    setIsPreparing(true);
    setProvenanceError(null);
    setSubmissionError(null);
    try {
      // Simulate after exact USDC approval. Simulating earlier checks allowance
      // and incorrectly blocks the very approval CTA needed to fund an order.
      const simulation = await publicClient.simulateContract({
        account: address,
        address: BATCH_PURCHASE_FACILITATOR_ADDRESS,
        abi: batchOrderAbi,
        functionName: 'createBatchOrder',
        args: createArgs,
      });
      create.writeContract(simulation.request);
    } catch (error) {
      setSubmissionError(
        error instanceof Error ? error : new Error('Bulk order preparation failed.'),
      );
    } finally {
      setIsPreparing(false);
    }
  };

  const cancelOrder = async () => {
    if (!address || !publicClient || activeOrder.data !== true) return;
    setCancellationError(null);
    try {
      const simulation = await publicClient.simulateContract({
        account: address,
        address: BATCH_PURCHASE_FACILITATOR_ADDRESS,
        abi: batchOrderAbi,
        functionName: 'cancelBatchOrder',
      });
      cancel.writeContract(simulation.request);
    } catch (error) {
      setCancellationError(error instanceof Error ? error : new Error('Bulk order cancellation failed.'));
    }
  };

  return {
    createOrder,
    cancelOrder,
    confirmedTickets,
    createdOrder,
    progress,
    minimumTicketCount: minimum.data,
    hasActiveOrder: activeOrder.data === true,
    orderInfo: orderInfo.data,
    refetchOrderInfo: orderInfo.refetch,
    create: {
      txHash: create.data,
      isWaitingSignature: create.isPending,
      isPreparing,
      isMining: createReceipt.isLoading,
      isPending: isPreparing || create.isPending || createReceipt.isLoading,
      isSuccess: createReceipt.isSuccess && provenanceError === null,
      isReady: createArgs !== undefined && activeOrder.data !== true && !isPreparing,
      error: provenanceError ?? submissionError ?? create.error ?? createReceipt.error,
      reset: () => {
        create.reset();
        setSubmissionError(null);
      },
    },
    cancel: {
      txHash: cancel.data,
      isWaitingSignature: cancel.isPending,
      isMining: cancelReceipt.isLoading,
      isPending: cancel.isPending || cancelReceipt.isLoading,
      isSuccess: cancelReceipt.isSuccess,
       error: cancellationError ?? cancel.error ?? cancelReceipt.error,
       reset: () => {
         cancel.reset();
         setCancellationError(null);
       },
    },
  };
}
