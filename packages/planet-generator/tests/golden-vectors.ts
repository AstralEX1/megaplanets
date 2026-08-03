import type { PlanetInput } from '../src';

export const SEASON_ID =
  '0xee23bca2927e52eeb944320241d7a6e41726dcb3f169d972044bdafe95b4b15b' as const;

export const GOLDEN_VECTORS = [
  {
    name: 'ticket-456',
    input: {
      seasonId: SEASON_ID,
      ticketId: 456n,
      drawingId: 123n,
      normals: [2, 7, 14, 22, 29],
      bonusBall: 9,
      originTxHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    },
  },
  {
    name: 'ticket-1001',
    input: {
      seasonId: SEASON_ID,
      ticketId: 1001n,
      drawingId: 500n,
      normals: [1, 8, 16, 24, 32],
      bonusBall: 1,
      originTxHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    },
  },
  {
    name: 'ticket-4242',
    input: {
      seasonId: SEASON_ID,
      ticketId: 4242n,
      drawingId: 42n,
      normals: [4, 8, 15, 16, 23],
      bonusBall: 12,
      originTxHash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    },
  },
] as const satisfies readonly { name: string; input: PlanetInput }[];
