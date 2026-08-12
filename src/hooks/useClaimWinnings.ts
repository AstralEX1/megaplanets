/**
 * ---
 * @skill      https://llms.megapot.io/tasks/claim-winnings
 * @contract   Jackpot.claimWinnings
 * @customize  Claims one or many tickets in a single tx — pass IDs across
 *             drawings if desired. The Data API's `/v1/wallets/{addr}/wins`
 *             feed already excludes losing tiers, so a fork that builds
 *             ticket lists off the API can pass IDs straight through here.
 * ---
 */
import { parseAbi } from 'viem';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAccount, usePublicClient, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { JACKPOT_ADDRESS } from '@/config/contracts';
import { MAX_CLAIM_BATCH } from '@/lib/tickets';
import { getTransactionReceiptError, isSuccessfulTransactionReceipt } from '@/lib/transactionReceipt';
import { invalidatePostWriteQueries } from '@/lib/queryInvalidation';

const abi = parseAbi(['function claimWinnings(uint256[] _userTicketIds)']);

export function useClaimWinnings() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const write = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: write.data });
  const receiptSucceeded = isSuccessfulTransactionReceipt(receipt.data);
  const [preparationError, setPreparationError] = useState<Error | null>(null);

  useEffect(() => {
    if (receiptSucceeded) void invalidatePostWriteQueries(queryClient);
  }, [queryClient, receiptSucceeded]);

  const claim = async (ticketIds: readonly bigint[]) => {
    if (!address || !publicClient || ticketIds.length === 0) return;
    if (ticketIds.length > MAX_CLAIM_BATCH) {
      // biome-ignore lint/suspicious/noConsole: deliberate diagnostic
      console.warn(
        `[megapot] claimWinnings called with ${ticketIds.length} ticket IDs; ` +
          `slicing to MAX_CLAIM_BATCH (${MAX_CLAIM_BATCH}) to stay under block gas limit. ` +
          `Call again with the remaining IDs after this tx confirms.`,
      );
    }
    setPreparationError(null);
    try {
      const batch = ticketIds.slice(0, MAX_CLAIM_BATCH);
      const simulation = await publicClient.simulateContract({
        account: address,
        address: JACKPOT_ADDRESS,
        abi,
        functionName: 'claimWinnings',
        args: [batch],
      });
      write.writeContract(simulation.request);
    } catch (error) {
      setPreparationError(error instanceof Error ? error : new Error('Claim preparation failed.'));
    }
  };

  return {
    claim,
    txHash: write.data,
    isWaitingSignature: write.isPending,
    isMining: receipt.isLoading,
    /** Combined "in-flight" flag. Kept for callers that only need a single bool. */
    isPending: write.isPending || receipt.isLoading,
    isSuccess: receiptSucceeded,
    error: preparationError ?? write.error ?? receipt.error ?? getTransactionReceiptError(receipt.data),
    reset: () => {
      write.reset();
      setPreparationError(null);
    },
  };
}
