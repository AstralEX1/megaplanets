import { describe, expect, it } from 'vitest';
import { validateTicketPurchasedFields } from './ticketValidation';

describe('validateTicketPurchasedFields', () => {
  it('normalizes a valid TicketPurchased payload and canonical position', () => {
    expect(validateTicketPurchasedFields({
      ticketId: 456n,
      drawingId: 123n,
      normals: [29, 2, 22, 7, 14],
      bonusBall: 9,
      logIndex: 4,
    })).toEqual({
      ticketId: 456n,
      drawingId: 123n,
      normals: [2, 7, 14, 22, 29],
      bonusBall: 9,
      logIndex: 4n,
    });
  });

  it.each([
    ['zero ticket ID', { ticketId: 0n }],
    ['zero drawing ID', { drawingId: 0n }],
    ['duplicate normal', { normals: [1, 1, 2, 3, 4] }],
    ['out-of-range normal', { normals: [1, 2, 3, 4, 256] }],
    ['out-of-range bonus', { bonusBall: 256 }],
    ['missing log index', { logIndex: undefined }],
  ])('rejects %s', (_name, override) => {
    expect(() => validateTicketPurchasedFields({
      ticketId: 456n,
      drawingId: 123n,
      normals: [1, 2, 3, 4, 5],
      bonusBall: 9,
      logIndex: 4,
      ...override,
    })).toThrow();
  });
});
