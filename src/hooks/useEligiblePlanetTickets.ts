import { useQuery } from '@tanstack/react-query';
import type { PublicClient } from 'viem';
import { usePublicClient } from 'wagmi';
import { CHAIN, JACKPOT_ADDRESS, MEGAPLANETS_LAUNCH_BLOCK, TICKET_SOURCE } from '@/config/contracts';
import { QK } from '@/lib/api';
import { jackpotPurchaseAbi, type PurchasedTicket } from '@/lib/purchaseReceipt';

const MAX_RPC_LOG_RANGE = 2_000n;
const ONE_MINUTE = 60 * 1000;

/** Reads canonical purchase events in bounded ranges accepted by the public Base Sepolia RPC. */
async function readEligibleTickets(
  client: PublicClient,
  account: `0x${string}`,
): Promise<readonly PurchasedTicket[]> {
  const latestBlock = await client.getBlockNumber();
  const logs = [];
  for (let fromBlock = MEGAPLANETS_LAUNCH_BLOCK; fromBlock <= latestBlock; fromBlock += MAX_RPC_LOG_RANGE) {
    const toBlock =
      fromBlock + MAX_RPC_LOG_RANGE - 1n > latestBlock
        ? latestBlock
        : fromBlock + MAX_RPC_LOG_RANGE - 1n;
    logs.push(
      ...(await client.getLogs({
        address: JACKPOT_ADDRESS,
        event: jackpotPurchaseAbi[1],
        args: { recipient: account, source: TICKET_SOURCE },
        fromBlock,
        toBlock,
      })),
    );
  }

  const tickets = logs.map((log) => {
    const { userTicketId, currentDrawingId, normals, bonusball } = log.args;
    if (
      userTicketId === undefined ||
      currentDrawingId === undefined ||
      !normals ||
      bonusball === undefined ||
      !log.transactionHash ||
      log.logIndex === null ||
      log.logIndex === undefined
    ) {
      throw new Error('A MegaPlanets TicketPurchased log was incomplete.');
    }
    return {
      ticketId: userTicketId,
      drawingId: currentDrawingId,
      normals: [...normals].map(Number).sort((left, right) => left - right),
      bonusBall: Number(bonusball),
      originTxHash: log.transactionHash,
      logIndex: typeof log.logIndex === 'number' ? BigInt(log.logIndex) : log.logIndex,
    } satisfies PurchasedTicket;
  });

  return tickets.sort((left, right) => {
    if (left.drawingId !== right.drawingId) return left.drawingId > right.drawingId ? -1 : 1;
    return left.logIndex > right.logIndex ? -1 : left.logIndex < right.logIndex ? 1 : 0;
  });
}

/** Discovers historical on-chain tickets without treating Data API indexing as purchase proof. */
export function useEligiblePlanetTickets(address: `0x${string}` | undefined) {
  const client = usePublicClient();
  const query = useQuery({
    queryKey: [QK.NS, 'eligible-planet-tickets', CHAIN, address],
    queryFn: () => {
      if (!client || !address) throw new Error('A public RPC client and connected wallet are required.');
      return readEligibleTickets(client as PublicClient, address);
    },
    enabled: CHAIN === 'testnet' && !!address && !!client,
    staleTime: ONE_MINUTE,
  });
  return { tickets: query.data ?? [], ...query };
}
