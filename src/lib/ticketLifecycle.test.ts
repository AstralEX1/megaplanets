import { describe, expect, it } from 'vitest';
import { canClaimTicket, claimBeforeRevealMessage } from './ticketLifecycle';

describe('ticket lifecycle claim guard', () => {
  it('does not allow an unrevealed winning ticket to be claimed', () => {
    expect(canClaimTicket({ revealed: false, status: 'claim' })).toBe(false);
    expect(claimBeforeRevealMessage()).toMatch(/reveal/i);
  });

  it('allows direct claim after reveal and preserves non-claim states', () => {
    expect(canClaimTicket({ revealed: true, status: 'claim' })).toBe(true);
    expect(canClaimTicket({ revealed: true, status: 'drawn' })).toBe(false);
    expect(canClaimTicket({ revealed: true, status: 'claimed' })).toBe(false);
  });
});
