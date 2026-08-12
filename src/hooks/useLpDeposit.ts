/**
 * ---
 * @skill      https://llms.megapot.io/tasks/lp-deposit
 * @contract   Jackpot.lpDeposit
 * @customize  Approval target = JACKPOT_ADDRESS (lpDeposit lives on the
 *             Jackpot contract, not JackpotLPManager). Capacity should be
 *             checked client-side via useLpInfo before calling.
 * ---
 */
import { parseAbi } from 'viem';
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { JACKPOT_ADDRESS } from '@/config/contracts';
import { getTransactionReceiptError, isSuccessfulTransactionReceipt } from '@/lib/transactionReceipt';

const abi = parseAbi(['function lpDeposit(uint256 _amountToDeposit)']);

export function useLpDeposit() {
  const write = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: write.data });
  const receiptSucceeded = isSuccessfulTransactionReceipt(receipt.data);

  const deposit = (amountUsdcRaw: bigint) => {
    if (amountUsdcRaw <= 0n) return;
    write.writeContract({
      address: JACKPOT_ADDRESS,
      abi,
      functionName: 'lpDeposit',
      args: [amountUsdcRaw],
    });
  };

  return {
    deposit,
    txHash: write.data,
    isWaitingSignature: write.isPending,
    isMining: receipt.isLoading,
    /** Combined "in-flight" flag. Kept for callers that only need a single bool. */
    isPending: write.isPending || receipt.isLoading,
    isSuccess: receiptSucceeded,
    error: write.error ?? receipt.error ?? getTransactionReceiptError(receipt.data),
    reset: write.reset,
  };
}
