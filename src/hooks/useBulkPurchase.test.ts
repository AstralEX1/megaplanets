import { describe, expect, it } from 'vitest';
import { hasBulkPurchaseContext } from './useBulkPurchase';

describe('bulk purchase query gating', () => {
  it('does not read the facilitator for a direct-ticket draft', () => {
    expect(hasBulkPurchaseContext({ dynamicCount: 3, staticTickets: [] }, null)).toBe(false);
  });

  it('enables facilitator reads for a bulk draft or persisted order', () => {
    expect(hasBulkPurchaseContext({ dynamicCount: 11, staticTickets: [] }, null)).toBe(true);
    expect(hasBulkPurchaseContext(null, {} as never)).toBe(true);
  });
});
