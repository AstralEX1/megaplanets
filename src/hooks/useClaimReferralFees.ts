/**
 * ---
 * @skill      https://llms.megapot.io/tasks/claim-referral-fees
 * @contract   Jackpot.referralFees(address) + Jackpot.claimReferralFees
 * @customize  Reads accumulated USDC for the connected wallet and claims for
 *             that same wallet. `claimReferralFees` is gated by msg.sender on
 *             the contract, so read and write must target the same address —
 *             this hook keeps that invariant by scoping both to the connected
 *             wallet only.
 * ---
 */
import { parseAbi } from 'viem';
import { useState } from 'react';
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import { JACKPOT_ADDRESS } from '@/config/contracts';
import { getTransactionReceiptError, isSuccessfulTransactionReceipt } from '@/lib/transactionReceipt';

const abi = parseAbi([
  'function referralFees(address) view returns (uint256)',
  'function claimReferralFees()',
]);

export function useClaimReferralFees() {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const balanceQuery = useReadContract({
    address: JACKPOT_ADDRESS,
    abi,
    functionName: 'referralFees',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const write = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: write.data });
  const receiptSucceeded = isSuccessfulTransactionReceipt(receipt.data);
  const [preparationError, setPreparationError] = useState<Error | null>(null);

  const claim = async () => {
    if (!address || !publicClient) return;
    setPreparationError(null);
    try {
      const simulation = await publicClient.simulateContract({
        account: address,
        address: JACKPOT_ADDRESS,
        abi,
        functionName: 'claimReferralFees',
      });
      write.writeContract(simulation.request);
    } catch (error) {
      setPreparationError(error instanceof Error ? error : new Error('Referral claim preparation failed.'));
    }
  };

  const earned = balanceQuery.data;
  const hasEarnings = earned !== undefined && earned > 0n;

  return {
    earned,
    hasEarnings,
    claim,
    refetch: balanceQuery.refetch,
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
