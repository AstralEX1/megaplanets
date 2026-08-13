import { encodeAbiParameters, encodeEventTopics, getAddress, stringToHex, type Log, type TransactionReceipt } from 'viem';
import { describe, expect, it } from 'vitest';
import { MEGAPLANETS_LAUNCH_BLOCK, MEGAPLANETS_SOURCE, MEGAPLANETS_TICKET_START_BLOCK } from './config';
import {
  BASE_SEPOLIA_JACKPOT,
  decodeEligibleTicket,
  findEligibleTicket,
  MegasteraVerifier,
  normalizeMegasteraProof,
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

  it('rejects purchases before the canonical activation boundary', () => {
    expect(() => decodeEligibleTicket(ticketLog({ blockNumber: MEGAPLANETS_TICKET_START_BLOCK - 1n }))).toThrow(
      'outside the eligible MegaPlanets range',
    );
  });

  it('accepts the canonical activation boundary before the Planet launch block', () => {
    expect(
      decodeEligibleTicket(ticketLog({ blockNumber: MEGAPLANETS_TICKET_START_BLOCK })).ticketId,
    ).toBe(456n);
  });
  it('locates the requested log index before decoding it', () => {
    const otherLog = ticketLog({ logIndex: 3 });
    expect(findEligibleTicket([otherLog, ticketLog()], 4).ticketId).toBe(456n);
    expect(() => findEligibleTicket([otherLog], 4)).toThrow('was not found in the receipt');
  });

  it('normalizes a receipt-backed Megastera proof without changing the Ethereum receipt type', () => {
    const source = stringToHex(MEGAPLANETS_SOURCE, { size: 32 });
    const proof = normalizeMegasteraProof({
      ...decodeEligibleTicket(ticketLog()),
      chainId: 84_532,
      jackpotAddress: BASE_SEPOLIA_JACKPOT.toLowerCase() as `0x${string}`,
      source,
    });

    expect(proof).toMatchObject({
      chainId: 84_532,
      jackpotAddress: BASE_SEPOLIA_JACKPOT,
      recipient: getAddress(recipient),
      source,
      ticketId: 456n,
    });
  });

  it('rejects a reverted, non-canonical, or wrong-recipient receipt', () => {
    const blockHash = `0x${'cd'.repeat(32)}` as `0x${string}`;
    const receipt = {
      status: 'success',
      transactionHash,
      blockHash,
      blockNumber: MEGAPLANETS_LAUNCH_BLOCK,
      logs: [ticketLog({ blockHash, transactionHash })],
    } as unknown as TransactionReceipt;
    const verifier = new MegasteraVerifier();

    expect(verifier.verifyReceipt(receipt, { logIndex: 4, recipient })).toMatchObject({ ticketId: 456n });
    expect(() => verifier.verifyReceipt({ ...receipt, status: 'reverted' }, { logIndex: 4, recipient })).toThrow(/did not succeed/i);
    expect(() => verifier.verifyReceipt({ ...receipt, blockHash: undefined } as unknown as TransactionReceipt, { logIndex: 4, recipient })).toThrow(/finalized block/i);
    expect(() => verifier.verifyReceipt(receipt, { logIndex: 4, recipient: '0x2222222222222222222222222222222222222222' })).toThrow(/recipient/i);
    expect(() => verifier.verifyReceipt(receipt, { logIndex: 99, recipient })).toThrow(/was not found/i);
  });

  it('rejects a source mismatch even when the receipt succeeded', () => {
    const blockHash = `0x${'cd'.repeat(32)}` as `0x${string}`;
    const log = ticketLog({
      blockHash,
      topics: encodeEventTopics({
        abi: TICKET_PURCHASED_ABI,
        eventName: 'TicketPurchased',
        args: {
          recipient,
          currentDrawingId: 123n,
          source: stringToHex('OTHER_SOURCE', { size: 32 }),
        },
      }) as Log['topics'],
    });
    const receipt = {
      status: 'success',
      transactionHash,
      blockHash,
      blockNumber: MEGAPLANETS_LAUNCH_BLOCK,
      logs: [log],
    } as unknown as TransactionReceipt;

    expect(() => new MegasteraVerifier().verifyReceipt(receipt, { logIndex: 4, recipient })).toThrow(/MEGAPLANETS_V1/i);
  });
});
