import { useEffect, useState } from 'react';
import { useAccount, usePublicClient, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import {
  JACKPOT_ADDRESS,
  REFERRAL_SPLIT_FULL,
  REFERRER_ADDRESS,
  TICKET_SOURCE,
} from '@/config/contracts';
import {
  jackpotPurchaseAbi,
  type PurchasedTicket,
  persistPurchasedTickets,
  readPurchasedTickets,
} from '@/lib/purchaseReceipt';
import { buildDirectTickets, type CustomTicket, type TicketBounds } from '@/lib/tickets';
import { getTransactionReceiptError, isSuccessfulTransactionReceipt } from '@/lib/transactionReceipt';

/** Immediate Megapot checkout for one to ten custom and client quick-pick tickets. */
export function useBuyTickets() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const write = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: write.data });
  const receiptSucceeded = isSuccessfulTransactionReceipt(receipt.data);
  const [purchasedTickets, setPurchasedTickets] = useState<readonly PurchasedTicket[]>([]);
  const [provenanceError, setProvenanceError] = useState<Error | null>(null);
  const [submissionError, setSubmissionError] = useState<Error | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);

  useEffect(() => {
    if (!receipt.data || !address || !receiptSucceeded) return;
    try {
      const parsed = readPurchasedTickets(receipt.data, address);
      persistPurchasedTickets(address, parsed);
      setPurchasedTickets(parsed);
      setProvenanceError(null);
    } catch (error) {
      setPurchasedTickets([]);
      setProvenanceError(error instanceof Error ? error : new Error('Ticket provenance failed.'));
    }
  }, [receipt.data, address, receiptSucceeded]);

  const buy = async (args: {
    customTickets: readonly CustomTicket[];
    count: number;
    bounds: TicketBounds;
  }) => {
    if (!address || !publicClient || isPreparing) return;
    setIsPreparing(true);
    setProvenanceError(null);
    setSubmissionError(null);
    try {
      const tickets = buildDirectTickets(args);
      const simulation = await publicClient.simulateContract({
        account: address,
        address: JACKPOT_ADDRESS,
        abi: jackpotPurchaseAbi,
        functionName: 'buyTickets',
        args: [
          tickets.map((ticket) => ({ normals: ticket.normals, bonusball: ticket.bonusball })),
          address,
          [REFERRER_ADDRESS],
          [...REFERRAL_SPLIT_FULL],
          TICKET_SOURCE,
        ],
      });
      write.writeContract(simulation.request);
    } catch (error) {
      setSubmissionError(
        error instanceof Error ? error : new Error('Ticket purchase preparation failed.'),
      );
    } finally {
      setIsPreparing(false);
    }
  };

  return {
    buy,
    purchasedTickets,
    txHash: write.data,
    isWaitingSignature: write.isPending,
    isPreparing,
    isMining: receipt.isLoading,
    isPending: isPreparing || write.isPending || receipt.isLoading,
    isSuccess: receiptSucceeded && provenanceError === null,
    isReady: address !== undefined && publicClient !== undefined && !isPreparing,
    error: provenanceError ?? submissionError ?? write.error ?? receipt.error ?? getTransactionReceiptError(receipt.data),
    reset: () => {
      write.reset();
      setPurchasedTickets([]);
      setProvenanceError(null);
      setSubmissionError(null);
    },
  };
}
