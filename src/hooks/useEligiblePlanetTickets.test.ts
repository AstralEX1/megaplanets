import { describe, expect, it, vi } from 'vitest';
import type { Ticket } from '@/lib/api';
import type { SerializedMegasteraProof } from '@/lib/backendApi';
import type { PurchasedTicket } from '@/lib/purchaseReceipt';
import {
  mergeEligibleTickets,
  readActivationEligibleTicketsFromChain,
  readEligiblePlanetTickets,
  readEligibleTicketsFromWalletHistory,
  readMegasteraProofsFromServer,
  readRecentEligibleTicketsFromChain,
  shouldEnableEligiblePlanetTickets,
} from './useEligiblePlanetTickets';

const ACCOUNT = '0x0000000000000000000000000000000000000001' as const;
const HASH_A = `0x${'a'.repeat(64)}` as const;
const HASH_B = `0x${'b'.repeat(64)}` as const;

describe('eligible Planet ticket query gating', () => {
  it('stays idle until an expedition or resumable session needs recovery', () => {
    expect(
      shouldEnableEligiblePlanetTickets({
        chain: 'testnet',
        hasAddress: true,
        hasClient: true,
        requested: false,
      }),
    ).toBe(false);
    expect(
      shouldEnableEligiblePlanetTickets({
        chain: 'testnet',
        hasAddress: true,
        hasClient: true,
        requested: true,
      }),
    ).toBe(true);
  });
});

function historyTicket(ticketId: string, transactionHash: `0x${string}`): Ticket {
  return {
    id: ticketId,
    wallet: ACCOUNT,
    buyer: ACCOUNT,
    round_id: '218',
    user_ticket_id: ticketId,
    normals: [4, 11, 17, 26, 39],
    bonusball: 66,
    matched_normals: null,
    bonusball_match: null,
    winnings_amount: null,
    claimed: false,
    claimed_tx_hash: null,
    tx_hash: transactionHash,
    block_number: 45_000_000,
    created_at: '2026-08-01T00:00:00.000Z',
  };
}

function confirmedTicket(
  ticketId: bigint,
  transactionHash: `0x${string}`,
  logIndex = 4n,
): PurchasedTicket {
  return {
    ticketId,
    drawingId: 218n,
    normals: [4, 11, 17, 26, 39],
    bonusBall: 66,
    originTxHash: transactionHash,
    logIndex,
  };
}

function serverProof(
  ticketId: string,
  transactionHash: `0x${string}`,
  logIndex = '4',
): SerializedMegasteraProof {
  return {
    recipient: ACCOUNT,
    ticketId,
    drawingId: '218',
    normals: [4, 11, 17, 26, 39],
    bonusBall: 66,
    originTxHash: transactionHash,
    blockNumber: '45000000',
    blockHash: `0x${'b'.repeat(64)}`,
    logIndex,
    chainId: 84532,
    jackpotAddress: '0x465dA3c859f193A3807386387bEE941B2A4c3279',
    source: `0x${Buffer.from('MEGAPLANETS_V1').toString('hex').padEnd(64, '0')}`,
  };
}

describe('readEligibleTicketsFromWalletHistory', () => {
  it('discovers paginated wallet history through receipts without running a chain-wide log scan', async () => {
    const getTransactionReceipt = vi
      .fn()
      .mockResolvedValueOnce({ transactionHash: HASH_A })
      .mockResolvedValueOnce({ transactionHash: HASH_B });
    const getLogs = vi.fn();
    const listWalletTickets = vi
      .fn()
      .mockResolvedValueOnce({
        data: [historyTicket('7', HASH_A)],
        has_more: true,
        next_cursor: 'next',
      })
      .mockResolvedValueOnce({
        data: [historyTicket('8', HASH_B)],
        has_more: false,
        next_cursor: null,
      });
    const readReceiptTickets = vi
      .fn()
      .mockReturnValueOnce([confirmedTicket(7n, HASH_A), confirmedTicket(999n, HASH_A)])
      .mockReturnValueOnce([confirmedTicket(8n, HASH_B, 5n)]);

    const tickets = await readEligibleTicketsFromWalletHistory(
      { getTransactionReceipt, getLogs } as never,
      ACCOUNT,
      { listWalletTickets, readReceiptTickets },
    );

    expect(tickets.map((ticket) => ticket.ticketId)).toEqual([8n, 7n]);
    expect(listWalletTickets).toHaveBeenNthCalledWith(1, ACCOUNT, {
      limit: 100,
      cursor: undefined,
    });
    expect(listWalletTickets).toHaveBeenNthCalledWith(2, ACCOUNT, { limit: 100, cursor: 'next' });
    expect(getTransactionReceipt).toHaveBeenCalledTimes(2);
    expect(getLogs).not.toHaveBeenCalled();
  });

  it('recovers recent canonical purchases before the Data API indexes them', async () => {
    const getBlockNumber = vi.fn().mockResolvedValue(45_341_720n);
    const getLogs = vi
      .fn()
      .mockResolvedValue([
        { transactionHash: HASH_A },
        { transactionHash: HASH_A },
        { transactionHash: HASH_B },
      ]);
    const getTransactionReceipt = vi
      .fn()
      .mockResolvedValueOnce({ transactionHash: HASH_A })
      .mockResolvedValueOnce({ transactionHash: HASH_B });
    const readReceiptTickets = vi
      .fn()
      .mockReturnValueOnce([confirmedTicket(70n, HASH_A), confirmedTicket(71n, HASH_A, 5n)])
      .mockReturnValueOnce([confirmedTicket(72n, HASH_B, 6n)]);

    const tickets = await readRecentEligibleTicketsFromChain(
      { getBlockNumber, getLogs, getTransactionReceipt } as never,
      ACCOUNT,
      { readReceiptTickets },
    );

    expect(tickets.map((ticket) => ticket.ticketId)).toEqual([72n, 71n, 70n]);
    expect(getTransactionReceipt).toHaveBeenCalledTimes(2);
    expect(getLogs).toHaveBeenCalledWith(
      expect.objectContaining({ fromBlock: 45_339_721n, toBlock: 45_341_720n }),
    );
  });
});

describe('readMegasteraProofsFromServer', () => {
  it('recovers paginated proofs and dedupes repeated ticket IDs', async () => {
    const listMegasteraProofs = vi
      .fn()
      .mockResolvedValueOnce({
        proofs: [serverProof('7', HASH_A)],
        total: 2,
        offset: 0,
        limit: 100,
      })
      .mockResolvedValueOnce({
        proofs: [serverProof('7', HASH_A), serverProof('8', HASH_B, '5')],
        total: 3,
        offset: 1,
        limit: 100,
      });

    const tickets = await readMegasteraProofsFromServer(ACCOUNT, { listMegasteraProofs });

    expect(tickets.map((ticket) => ticket.ticketId)).toEqual([8n, 7n]);
    expect(listMegasteraProofs).toHaveBeenNthCalledWith(1, ACCOUNT, { offset: 0, limit: 100 });
    expect(listMegasteraProofs).toHaveBeenNthCalledWith(2, ACCOUNT, { offset: 1, limit: 100 });
  });

  it('rejects a proof that is not for the canonical wallet or protocol', async () => {
    await expect(
      readMegasteraProofsFromServer(ACCOUNT, {
        listMegasteraProofs: async () => ({
          proofs: [
            {
              ...serverProof('7', HASH_A),
              recipient: '0x0000000000000000000000000000000000000002',
            },
          ],
          total: 1,
          offset: 0,
          limit: 100,
        }),
      }),
    ).rejects.toThrow(/recipient/i);
  });
});

describe('mergeEligibleTickets', () => {
  it('lets receipt-verified RPC provenance override a stale server proof', () => {
    const proof = confirmedTicket(7n, HASH_A, 4n);
    const receipt = confirmedTicket(7n, HASH_B, 5n);
    expect(mergeEligibleTickets([proof], [receipt])).toEqual([receipt]);
  });
});

describe('readEligiblePlanetTickets', () => {
  it('keeps durable server proofs when the optional chain history sources are unavailable', async () => {
    const tickets = await readEligiblePlanetTickets(
      {
        getBlockNumber: vi.fn().mockRejectedValue(new Error('RPC unavailable')),
        getLogs: vi.fn().mockRejectedValue(new Error('RPC unavailable')),
        getTransactionReceipt: vi.fn().mockRejectedValue(new Error('RPC unavailable')),
      } as never,
      ACCOUNT,
      {
        listMegasteraProofs: async () => ({
          proofs: [serverProof('7', HASH_A)],
          total: 1,
          offset: 0,
          limit: 100,
        }),
        listWalletTickets: async () => {
          throw new Error('Data API unavailable');
        },
      },
    );

    expect(tickets.map((ticket) => ticket.ticketId)).toEqual([7n]);
  });
});

describe('readActivationEligibleTicketsFromChain', () => {
  it('recovers the canonical pre-launch activation window from receipts', async () => {
    const getLogs = vi
      .fn()
      .mockResolvedValue([{ transactionHash: HASH_A }, { transactionHash: HASH_A }]);
    const getTransactionReceipt = vi.fn().mockResolvedValue({ transactionHash: HASH_A });
    const readReceiptTickets = vi
      .fn()
      .mockReturnValue([
        confirmedTicket(90187820829801269348n, HASH_A),
        confirmedTicket(71845936741832571838n, HASH_A, 8n),
      ]);

    const tickets = await readActivationEligibleTicketsFromChain(
      { getLogs, getTransactionReceipt } as never,
      ACCOUNT,
      { readReceiptTickets },
    );

    expect(tickets.map((ticket) => ticket.ticketId)).toEqual([
      71845936741832571838n,
      90187820829801269348n,
    ]);
    expect(getLogs).toHaveBeenCalledWith(
      expect.objectContaining({ fromBlock: 44_996_796n, toBlock: 44_996_845n }),
    );
    expect(getLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ fromBlock: 44_997_146n, toBlock: 44_997_183n }),
    );
    expect(getTransactionReceipt).toHaveBeenCalledTimes(1);
  });
});
