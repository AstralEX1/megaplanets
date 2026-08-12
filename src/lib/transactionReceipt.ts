/** Returns true only when a transaction receipt has the canonical success status. */
export function isSuccessfulTransactionReceipt(
  receipt: { status?: unknown } | null | undefined,
): boolean {
  return receipt?.status === 'success';
}

/** Converts a reverted receipt into the same error shape used by write-hook UI. */
const TRANSACTION_REVERTED_ERROR = new Error('Transaction reverted on-chain.');

export function getTransactionReceiptError(
  receipt: { status?: unknown } | null | undefined,
): Error | null {
  return receipt?.status === 'reverted' ? TRANSACTION_REVERTED_ERROR : null;
}
