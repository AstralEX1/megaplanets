import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPublicClient, type Hex } from 'viem';
import { MEGAPLANETS_LAUNCH_BLOCK } from './config';
import { indexEligibleTickets } from './indexer';

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem');
  return { ...actual, createPublicClient: vi.fn() };
});

function blockHash(blockNumber: bigint): Hex {
  return `0x${blockNumber.toString(16).padStart(64, '0')}`;
}

describe('ticket indexer cursor hashing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('replays from the launch block when the stored cursor hash no longer matches canon', async () => {
    const client = {
      getBlockNumber: vi.fn().mockResolvedValue(MEGAPLANETS_LAUNCH_BLOCK + 8n),
      getBlock: vi.fn(async ({ blockNumber }: { blockNumber: bigint }) => ({
        hash: blockHash(blockNumber),
        timestamp: 1n,
      })),
      getLogs: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(createPublicClient).mockReturnValue(client as never);

    const store = {
      getCursor: vi.fn().mockResolvedValue({
        nextBlock: MEGAPLANETS_LAUNCH_BLOCK + 2n,
        lastBlockHash: blockHash(123n),
      }),
      saveTicket: vi.fn(),
      setCursor: vi.fn().mockResolvedValue(undefined),
      rewind: vi.fn().mockResolvedValue(undefined),
    };

    const result = await indexEligibleTickets(
      { rpcUrl: 'https://rpc.example.test', launchBlock: MEGAPLANETS_LAUNCH_BLOCK },
      store as never,
      { confirmations: 6n, blockRange: 10n },
    );

    expect(store.rewind).toHaveBeenCalledWith(MEGAPLANETS_LAUNCH_BLOCK);
    expect(client.getLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        fromBlock: MEGAPLANETS_LAUNCH_BLOCK,
        toBlock: MEGAPLANETS_LAUNCH_BLOCK + 2n,
      }),
    );
    expect(result).toMatchObject({
      fromBlock: MEGAPLANETS_LAUNCH_BLOCK,
      throughBlock: MEGAPLANETS_LAUNCH_BLOCK + 2n,
      ticketsIndexed: 0,
      reorgDetected: true,
    });
  });

  it('persists the cursor hash for an empty finalized range', async () => {
    const client = {
      getBlockNumber: vi.fn().mockResolvedValue(MEGAPLANETS_LAUNCH_BLOCK + 6n),
      getBlock: vi.fn(async ({ blockNumber }: { blockNumber: bigint }) => ({
        hash: blockHash(blockNumber),
        timestamp: 1n,
      })),
      getLogs: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(createPublicClient).mockReturnValue(client as never);

    const store = {
      getCursor: vi.fn().mockResolvedValue(undefined),
      saveTicket: vi.fn(),
      setCursor: vi.fn().mockResolvedValue(undefined),
      rewind: vi.fn().mockResolvedValue(undefined),
    };

    const result = await indexEligibleTickets(
      { rpcUrl: 'https://rpc.example.test', launchBlock: MEGAPLANETS_LAUNCH_BLOCK },
      store as never,
      { confirmations: 6n, blockRange: 1n },
    );

    expect(store.setCursor).toHaveBeenCalledWith(
      MEGAPLANETS_LAUNCH_BLOCK + 1n,
      blockHash(MEGAPLANETS_LAUNCH_BLOCK),
    );
    expect(result).toMatchObject({
      fromBlock: MEGAPLANETS_LAUNCH_BLOCK,
      throughBlock: MEGAPLANETS_LAUNCH_BLOCK,
      ticketsIndexed: 0,
      reorgDetected: false,
    });
  });
});
