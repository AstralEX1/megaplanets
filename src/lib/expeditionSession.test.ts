// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearExpeditionSession,
  readExpeditionSession,
  writeExpeditionSession,
} from './expeditionSession';

const account = '0x0000000000000000000000000000000000000001' as const;

describe('expedition session', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips only resumable configuration and transaction references', () => {
    writeExpeditionSession({
      version: 1,
      account,
      chainId: 84532,
      purchaseMode: 'direct',
      drawingId: '218',
      quantity: 2,
      automaticQuickPick: false,
      coordinates: [{ normals: [1, 2, 3, 4, 5], bonusball: 6 }],
      purchaseTxHash: `0x${'1'.repeat(64)}`,
      bulkOrderReference: null,
      createdAt: 123,
    });
    expect(readExpeditionSession(account, 84532)).toEqual({
      version: 1,
      account,
      chainId: 84532,
      purchaseMode: 'direct',
      drawingId: '218',
      quantity: 2,
      automaticQuickPick: false,
      coordinates: [{ normals: [1, 2, 3, 4, 5], bonusball: 6 }],
      purchaseTxHash: `0x${'1'.repeat(64)}`,
      bulkOrderReference: null,
      createdAt: 123,
    });
  });

  it('does not resume a session under a different wallet or chain', () => {
    writeExpeditionSession({
      version: 1,
      account,
      chainId: 84532,
      purchaseMode: 'bulk',
      drawingId: '218',
      quantity: 50,
      automaticQuickPick: true,
      coordinates: [],
      purchaseTxHash: null,
      bulkOrderReference: `0x${'2'.repeat(64)}`,
      createdAt: 123,
    });
    expect(readExpeditionSession('0x0000000000000000000000000000000000000002', 84532)).toBeNull();
    expect(readExpeditionSession(account, 8453)).toBeNull();
    clearExpeditionSession(account, 84532);
    expect(readExpeditionSession(account, 84532)).toBeNull();
  });

  it('rejects malformed local data instead of treating it as canonical progress', () => {
    localStorage.setItem(
      `megaplanets:expedition:v1:84532:${account}`,
      JSON.stringify({ version: 1, account, chainId: 84532, quantity: 99, ticketIds: ['1'] }),
    );
    expect(readExpeditionSession(account, 84532)).toBeNull();
  });
});
