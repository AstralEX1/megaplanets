import type { PlanetInput } from '../src';

export const GOLDEN_VECTORS = [
  {
    name: 'ticket-456',
    input: {
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
      ticketId: 4242n,
      drawingId: 42n,
      normals: [4, 8, 15, 16, 23],
      bonusBall: 12,
      originTxHash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    },
  },
] as const satisfies readonly { name: string; input: PlanetInput }[];
