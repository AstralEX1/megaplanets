import type { PlanetTicketInput } from '../src';

export const GOLDEN_VECTORS: readonly {
  name: string;
  input: PlanetTicketInput;
  seed: `0x${string}`;
}[] = [
  {
    name: 'ticket-456',
    input: { ticketId: 456n, drawingId: 123n, normals: [2, 7, 14, 22, 29], bonusBall: 9 },
    seed: '0x5fd7c2982bf2985ac18f959774957fed095d998b5517d61baae5b76cffb36c49',
  },
  {
    name: 'ticket-1001',
    input: { ticketId: 1001n, drawingId: 500n, normals: [1, 8, 16, 24, 32], bonusBall: 1 },
    seed: '0x5210570b9402f79ec0ba99b51e60a00299303bb23591434c512b45a37ac38c55',
  },
  {
    name: 'ticket-4242',
    input: { ticketId: 4242n, drawingId: 42n, normals: [4, 8, 15, 16, 23], bonusBall: 12 },
    seed: '0x6538d5a6ac6e04019464d89a108fa24e1ac5edad07c77d37cb1402580d1e2bcc',
  },
] as const;
