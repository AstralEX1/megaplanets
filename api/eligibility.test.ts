import { encodeAbiParameters, encodeEventTopics, stringToHex, type Log } from 'viem';
import { describe, expect, it } from 'vitest';
import { MEGAPLANETS_LAUNCH_BLOCK, MEGAPLANETS_SOURCE } from './config';
import {
  BASE_SEPOLIA_JACKPOT,
  decodeEligibleTicket,
  findEligibleTicket,
  TICKET_PURCHASED_ABI,
} from './eligibility';

const recipient = '0x1111111111111111111111111111111111111111' as const;
const transactionHash = `0x${'ab'.repeat(32)}` as const;

function ticketLog(overrides: Partial<Log> = {}): Log {
  const source = stringToHex(MEGAPLANETS_SOURCE, { size: 32 });
  return {
    address: BASE_SEPOLIA_JACKPOT,
    blockNumber: MEGAPLANETS_LAUNCH_BLOCK,
    transactionHash,
    logIndex: 4,
    topics: encodeEventTopics({
      abi: TICKET_PURCHASED_ABI,
      eventName: 'TicketPurchased',
      args: { recipient, currentDrawingId: 123n, source },
    }),
    data: encodeAbiParameters(
      [
        { name: 'userTicketId', type: 'uint256' },
        { name: 'normals', type: 'uint8[]' },
        { name: 'bonusball', type: 'uint8' },
        { name: 'referralScheme', type: 'bytes32' },
      ],
      [456n, [2, 7, 14, 22, 29], 9, `0x${'00'.repeat(32)}`],
    ),
    ...overrides,
  } as Log;
}

describe('MegaPlanets eligibility', () => {
  it('decodes only a confirmed MegaPlanets purchase log', () => {
    expect(decodeEligibleTicket(ticketLog())).toEqual({
      recipient,
      ticketId: 456n,
      drawingId: 123n,
      normals: [2, 7, 14, 22, 29],
      bonusBall: 9,
      originTxHash: transactionHash,
      blockNumber: MEGAPLANETS_LAUNCH_BLOCK,
      logIndex: 4n,
    });
  });

  it('rejects purchases before the configured launch block', () => {
    expect(() => decodeEligibleTicket(ticketLog({ blockNumber: MEGAPLANETS_LAUNCH_BLOCK - 1n }))).toThrow(
      'outside the eligible MegaPlanets range',
    );
  });

  it('locates the requested log index before decoding it', () => {
    const otherLog = ticketLog({ logIndex: 3 });
    expect(findEligibleTicket([otherLog, ticketLog()], 4).ticketId).toBe(456n);
    expect(() => findEligibleTicket([otherLog], 4)).toThrow('was not found in the receipt');
  });
});
