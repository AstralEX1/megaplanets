/**
 * ---
 * @customize  Pure display. Pass tx state from any wagmi write hook
 *             (useWriteContract + useWaitForTransactionReceipt). Includes a
 *             BaseScan link when a hash is available.
 *
 *             On-chain write/receipt errors remain generic so raw wagmi/viem
 *             revert reasons and RPC noise do not leak into the UI. Typed
 *             voucher-service failures are safe preflight messages and retain
 *             their request reference for support/debugging.
 * ---
 */

import { ExternalLinkIcon } from '@/components/icons/ExternalLinkIcon';
import { EXPLORER_TX_URL } from '@/config/contracts';
import { isPlanetVoucherServiceError } from '@/lib/planetVoucher';

type Variant = 'pending' | 'success' | 'error';

const STYLES: Record<Variant, string> = {
  pending:
    'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  success:
    'border-brand-primary-300 bg-brand-primary-50 text-brand-primary-800 dark:border-brand-primary-900 dark:bg-brand-primary-950 dark:text-brand-primary-200',
  error:
    'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200',
};

export function TxStatus({
  hash,
  isPending,
  isSuccess,
  error,
}: {
  hash: `0x${string}` | undefined;
  isPending: boolean;
  isSuccess: boolean;
  error: Error | null | undefined;
}) {
  if (!hash && !isPending && !error) return null;

  let variant: Variant = 'pending';
  let label = 'Submitting…';
  const voucherError = error && isPlanetVoucherServiceError(error) ? error : undefined;
  if (error) {
    variant = 'error';
    label = voucherError ? voucherError.message : 'Transaction failed — please try again.';
  } else if (isSuccess) {
    variant = 'success';
    label = 'Confirmed';
  } else if (hash) {
    variant = 'pending';
    label = 'Waiting for confirmation…';
  }

  return (
    <div
      className={`flex items-center justify-between rounded-md border px-3 py-2 text-xs font-medium ${STYLES[variant]}`}
      role="status"
      aria-live="polite"
      data-error-stage={voucherError?.stage}
      data-error-code={voucherError?.code}
      data-request-id={voucherError?.requestId}
    >
      <span>
        {label}
        {voucherError?.requestId ? (
          <span className="ml-2 opacity-80">Reference {voucherError.requestId}</span>
        ) : null}
      </span>
      {hash && (
        <a
          href={`${EXPLORER_TX_URL}${hash}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 underline underline-offset-2 hover:opacity-80"
        >
          tx <ExternalLinkIcon width={10} height={10} />
        </a>
      )}
    </div>
  );
}
