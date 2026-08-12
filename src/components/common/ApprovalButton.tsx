/**
 * ---
 * @skill      https://llms.megapot.io/tasks/buy-tickets
 * @customize  Generic USDC approve flow. Pass any `spender` so one wrapper
 *             works across Jackpot / BatchPurchaseFacilitator /
 *             JackpotAutoSubscription / JackpotLPManager. The gate compares
 *             allowance with the exact next purchase, while approval uses
 *             `maxUint256` for the documented "approve once" UX.
 *
 *             Children-passthrough pattern. Wrap the downstream submit
 *             button inside `<ApprovalButton>`; when allowance is
 *             insufficient we render the Approve button instead of the
 *             children, so the user only ever sees one CTA at a time:
 *
 *               <ApprovalButton spender={addr} amount={cost}>
 *                 <Button variant="primary" onClick={submit}>Buy</Button>
 *               </ApprovalButton>
 *
 *             Children show through whenever:
 *               - wallet is disconnected
 *               - amount is 0n (nothing to approve yet)
 *               - allowance query is still loading
 *               - allowance is already ≥ amount
 *
 *             so the submit CTA stays visible (and the parent can keep it
 *             disabled via its own guard) in every state except the brief
 *             "approval required" gate.
 * ---
 */
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { erc20Abi, maxUint256 } from 'viem';
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { USDC_ADDRESS } from '@/config/contracts';
import { useUsdcAllowance } from '@/hooks/useUsdcAllowance';
import { Button } from './Button';
import { getTransactionReceiptError, isSuccessfulTransactionReceipt } from '@/lib/transactionReceipt';

export function ApprovalButton({
  spender,
  amount,
  onApproved,
  children,
}: {
  spender: `0x${string}`;
  amount: bigint;
  onApproved?: () => void;
  /** Rendered when no approval is needed (sufficient allowance, or pre-resolution states). */
  children?: ReactNode;
}) {
  const { address } = useAccount();
  const { allowance, error: allowanceError, isLoading: isAllowanceLoading, refetch } = useUsdcAllowance(
    address,
    spender,
  );

  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();
  const { data: receipt, isLoading } = useWaitForTransactionReceipt({
    hash: txHash,
  });
  const isSuccess = isSuccessfulTransactionReceipt(receipt);
  const receiptError = getTransactionReceiptError(receipt);
  const [isRefreshingAllowance, setIsRefreshingAllowance] = useState(false);

  // Fire-once gate keyed on `txHash`. The parent may pass a fresh
  // `onApproved` reference each render, which would otherwise re-run
  // this effect even after the approval already completed. Tying the
  // gate to the tx hash means a future approval with a new hash
  // legitimately re-fires; the same hash can only fire once.
  const firedHashRef = useRef<typeof txHash | null>(null);

  useEffect(() => {
    if (!isSuccess || !txHash) return;
    if (firedHashRef.current === txHash) return;
    firedHashRef.current = txHash;
    onApproved?.();
    setIsRefreshingAllowance(true);
    void Promise.resolve(refetch()).finally(() => {
      setIsRefreshingAllowance(false);
      reset();
    });
  }, [isSuccess, txHash, refetch, onApproved, reset]);

  const requiresAllowance = !!address && amount > 0n;
  if (requiresAllowance && isAllowanceLoading) {
    return (
      <Button variant="secondary" size="md" disabled className="w-full">
        Checking USDC approval…
      </Button>
    );
  }

  if (requiresAllowance && allowanceError) {
    return (
      <div className="space-y-1">
        <Button variant="secondary" size="md" disabled className="w-full">
          Could not check USDC approval
        </Button>
        <p className="text-xs text-rose-600 dark:text-rose-400">Retry after your RPC connection recovers.</p>
      </div>
    );
  }

  if (requiresAllowance && isRefreshingAllowance) {
    return (
      <Button variant="secondary" size="md" disabled className="w-full">
        Refreshing USDC approval…
      </Button>
    );
  }

  // Only show the Approve CTA when the resolved allowance is insufficient.
  const needsApproval = !!address && amount > 0n && allowance !== undefined && allowance < amount;

  if (!needsApproval) return <>{children}</>;

  const onClick = () =>
    writeContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'approve',
      args: [spender, maxUint256],
    });

  const busy = isPending || isLoading || isRefreshingAllowance;

  return (
    <div className="space-y-1">
      <Button variant="primary" size="md" onClick={onClick} disabled={busy} className="w-full">
        {isPending ? (
          'Sign in your wallet…'
        ) : isLoading ? (
          'Approving on-chain…'
        ) : (
          'Approve USDC'
        )}
      </Button>
      {(error ?? receiptError) && (
        <p className="text-xs text-rose-600 dark:text-rose-400">
          Approval failed — please try again.
        </p>
      )}
    </div>
  );
}
