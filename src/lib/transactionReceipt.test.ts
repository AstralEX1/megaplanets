import { describe, expect, it } from 'vitest';
import { isSuccessfulTransactionReceipt } from './transactionReceipt';

describe('isSuccessfulTransactionReceipt', () => {
  it('accepts only a receipt with the literal success status', () => {
    expect(isSuccessfulTransactionReceipt({ status: 'success' })).toBe(true);
  });

  it('rejects reverted, missing, and unknown receipt statuses', () => {
    expect(isSuccessfulTransactionReceipt({ status: 'reverted' })).toBe(false);
    expect(isSuccessfulTransactionReceipt(undefined)).toBe(false);
    expect(isSuccessfulTransactionReceipt({ status: 'confirmed' })).toBe(false);
  });
});
