import { useEffect, useMemo, useState } from 'react';
import {
  useAccount,
  useSimulateContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import {
  JACKPOT_ADDRESS,
  REFERRAL_SPLIT_FULL,
  REFERRER_ADDRESS,
  TICKET_SOURCE,
} from '@/config/contracts';
import {
  jackpotPurchaseAbi,
  type PurchasedTicket,
  persistPurchasedTicket,
  readPurchasedTicket,
} from '@/lib/purchaseReceipt';
import type { CustomTicket } from '@/lib/tickets';

/** One-ticket-only Megapot purchase flow used by the MVP. */
export function useBuyTickets(ticket: CustomTicket | null) {
  const { address } = useAccount();
  const write = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: write.data });
  const [purchasedTicket, setPurchasedTicket] = useState<PurchasedTicket | null>(null);

  const args = useMemo(
    () =>
      address && ticket
        ? ([
            [{ normals: ticket.normals, bonusball: ticket.bonusball }],
            address,
            [REFERRER_ADDRESS],
            [...REFERRAL_SPLIT_FULL],
            TICKET_SOURCE,
          ] as const)
        : undefined,
    [address, ticket],
  );

  const simulation = useSimulateContract({
    address: JACKPOT_ADDRESS,
    abi: jackpotPurchaseAbi,
    functionName: 'buyTickets',
    args,
    query: { enabled: args !== undefined },
  });

  useEffect(() => {
    if (!receipt.data || !address) return;
    const parsed = readPurchasedTicket(receipt.data);
    if (!parsed) return;
    setPurchasedTicket(parsed);
    persistPurchasedTicket(address, parsed);
  }, [receipt.data, address]);

  const buy = () => {
    if (!simulation.data?.request) return;
    write.writeContract(simulation.data.request);
  };

  return {
    buy,
    purchasedTicket,
    txHash: write.data,
    isWaitingSignature: write.isPending,
    isMining: receipt.isLoading,
    isPending: write.isPending || receipt.isLoading,
    isSuccess: receipt.isSuccess,
    isReady: simulation.data !== undefined,
    error: write.error ?? receipt.error ?? simulation.error,
    reset: () => {
      write.reset();
      setPurchasedTicket(null);
    },
  };
}
