import { describe, expect, it } from 'vitest';
import { clampExpeditionQuantity, deriveExpeditionFlow } from './expeditionFlow';

describe('clampExpeditionQuantity', () => {
  it('keeps the Paper expedition range within 1 through 50', () => {
    expect(clampExpeditionQuantity(-2)).toBe(1);
    expect(clampExpeditionQuantity(3)).toBe(3);
    expect(clampExpeditionQuantity(99)).toBe(50);
  });
});

describe('deriveExpeditionFlow', () => {
  const base = {
    isActive: true,
    expectedTicketCount: 50,
    confirmedTicketCount: 0,
    isBulkOrder: true,
    isWaitingSignature: false,
    isMiningPurchase: false,
    isPurchaseConfirmed: true,
    revealState: 'idle' as const,
    error: null,
  };

  it('does not expose Reveal until every bulk ticket has canonical confirmation', () => {
    expect(deriveExpeditionFlow({ ...base, confirmedTicketCount: 49 }).scene).toBe(
      'discovering-planets',
    );
    expect(deriveExpeditionFlow({ ...base, confirmedTicketCount: 50 }).scene).toBe(
      'signals-located',
    );
  });

  it('separates receipt confirmation from ticket verification', () => {
    expect(
      deriveExpeditionFlow({ ...base, isBulkOrder: false, expectedTicketCount: 3 }).scene,
    ).toBe('verifying-tickets');
  });

  it('keeps reveal wallet confirmation and receipt confirmation distinct', () => {
    expect(
      deriveExpeditionFlow({
        ...base,
        expectedTicketCount: 1,
        confirmedTicketCount: 1,
        revealState: 'wallet-confirmation',
      }).scene,
    ).toBe('reveal-wallet-confirmation');
    expect(
      deriveExpeditionFlow({
        ...base,
        expectedTicketCount: 1,
        confirmedTicketCount: 1,
        revealState: 'confirming',
      }).scene,
    ).toBe('confirming-reveal');
    expect(
      deriveExpeditionFlow({
        ...base,
        expectedTicketCount: 1,
        confirmedTicketCount: 1,
        revealState: 'complete',
      }).scene,
    ).toBe('results');
  });

  it('returns a recoverable error without losing the active stage', () => {
    expect(
      deriveExpeditionFlow({ ...base, isPurchaseConfirmed: false, error: new Error('rejected') }),
    ).toEqual({ step: 'explore', scene: 'recoverable-error' });
  });

  it('keeps a failed reveal at the Reveal step so the same action can retry', () => {
    expect(
      deriveExpeditionFlow({
        ...base,
        expectedTicketCount: 1,
        confirmedTicketCount: 1,
        revealState: 'error',
      }),
    ).toEqual({ step: 'reveal', scene: 'recoverable-error' });
  });
});
