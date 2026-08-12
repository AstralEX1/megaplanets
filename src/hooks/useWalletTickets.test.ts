import { describe, expect, it } from 'vitest';
import { shouldLoadOlderTicketRounds } from './useWalletTickets';

describe('wallet ticket history pagination', () => {
  it('requires an explicit load when the first page already contains ten rounds', () => {
    expect(shouldLoadOlderTicketRounds(10, 10, true)).toBe(true);
    expect(shouldLoadOlderTicketRounds(12, 10, false)).toBe(true);
    expect(shouldLoadOlderTicketRounds(10, 10, false)).toBe(false);
  });
});
