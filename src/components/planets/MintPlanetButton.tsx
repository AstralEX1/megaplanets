import { useEffect, useRef, useState } from 'react';
import { useAccount, useChainId, usePublicClient, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import type { PlanetPreview } from '@megaplanets/planet-generator';
import { Button } from '@/components/common/Button';
import { TxStatus } from '@/components/common/TxStatus';
import { CHAIN, JACKPOT_TICKET_NFT_ADDRESS, MEGAPLANETS_CONTRACT_ADDRESS } from '@/config/contracts';
import { megaPlanetsAbi } from '@/lib/megaPlanets';
import { isPlanetVoucherServiceConfigured, requestPlanetVoucher } from '@/lib/planetVoucher';
import { getTransactionReceiptError, isSuccessfulTransactionReceipt } from '@/lib/transactionReceipt';
import { getPlanetAvailability } from '@/lib/planetAvailability';
import { getLiveRevealCandidates, type RevealUnavailable } from '@/lib/planetReveal';
import { baseSepolia } from 'viem/chains';

export function MintPlanetButton({
  preview,
  logIndex,
  buttonLabel,
  onMinted,
  onUnavailable,
  onStateChange,
}: {
  preview: PlanetPreview;
  logIndex: bigint | undefined;
  buttonLabel?: string;
  onMinted?: (ticketId: bigint) => void;
  onUnavailable?: (ticket: RevealUnavailable) => void;
  onStateChange?: (
    state: 'idle' | 'wallet-confirmation' | 'confirming' | 'complete' | 'error',
  ) => void;
}) {
  const { address } = useAccount();
  const walletChainId = useChainId();
  const publicClient = usePublicClient();
  const write = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: write.data });
  const receiptSucceeded = isSuccessfulTransactionReceipt(receipt.data);
  const receiptError = getTransactionReceiptError(receipt.data);
  const hasNotifiedMint = useRef(false);
  const [preparationError, setPreparationError] = useState<Error | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const availability = getPlanetAvailability({
    appChain: CHAIN,
    walletConnected: !!address,
    walletChainId,
    contractConfigured: !!MEGAPLANETS_CONTRACT_ADDRESS,
    baseSepoliaChainId: baseSepolia.id,
  });
  const canMint =
    availability === 'ready' &&
    !!address &&
    !!publicClient &&
    !!MEGAPLANETS_CONTRACT_ADDRESS &&
    logIndex !== undefined &&
    isPlanetVoucherServiceConfigured;

  useEffect(() => {
    if (!receiptSucceeded) {
      hasNotifiedMint.current = false;
      return;
    }
    if (hasNotifiedMint.current) return;
    hasNotifiedMint.current = true;
    onMinted?.(preview.descriptor.input.ticketId);
  }, [onMinted, preview.descriptor.input.ticketId, receiptSucceeded]);

  useEffect(() => {
    if (receiptSucceeded) onStateChange?.('complete');
    else if (preparationError || write.error || receipt.error || receiptError) onStateChange?.('error');
    else if (receipt.isLoading) onStateChange?.('confirming');
    else if (isPreparing || write.isPending) onStateChange?.('wallet-confirmation');
    else onStateChange?.('idle');
  }, [
    isPreparing,
    onStateChange,
    preparationError,
    receipt.error,
    receipt.isLoading,
    receiptError,
    receiptSucceeded,
    write.error,
    write.isPending,
  ]);

  const mint = async () => {
    if (
      !canMint ||
      !address ||
      !publicClient ||
      !MEGAPLANETS_CONTRACT_ADDRESS ||
      logIndex === undefined
    )
      return;
    setPreparationError(null);
    setIsPreparing(true);
    try {
      const availabilityCheck = await getLiveRevealCandidates(
        publicClient,
        address,
        [{ ticketId: preview.descriptor.input.ticketId, logIndex }],
        JACKPOT_TICKET_NFT_ADDRESS,
      );
      if (availabilityCheck.unavailable.length > 0) {
        const unavailable = availabilityCheck.unavailable[0];
        if (unavailable?.reason !== 'unreadable' && unavailable) onUnavailable?.(unavailable);
        const reason = unavailable?.reason;
        throw new Error(
          reason === 'transferred'
            ? 'This ticket is no longer owned by the connected wallet and cannot reveal.'
            : reason === 'burned'
              ? 'This ticket was burned and cannot reveal.'
              : 'Ticket ownership could not be read. Check the Base Sepolia RPC and retry.',
        );
      }
      const prepared = await requestPlanetVoucher({
        transactionHash: preview.descriptor.input.originTxHash,
        logIndex,
      });
      if (prepared.voucher.recipient.toLowerCase() !== address.toLowerCase()) {
        throw new Error('Voucher recipient does not match the connected wallet.');
      }
      const simulation = await publicClient.simulateContract({
        account: address,
        address: MEGAPLANETS_CONTRACT_ADDRESS,
        abi: megaPlanetsAbi,
        functionName: 'mint',
        args: [prepared.voucher, prepared.signature],
      });
      write.writeContract(simulation.request);
    } catch (error) {
      setPreparationError(
        error instanceof Error ? error : new Error('Planet mint preparation failed.'),
      );
    } finally {
      setIsPreparing(false);
    }
  };

  if (availability === 'unsupported-mainnet') {
    return <p className="text-xs text-zinc-500">Planet reveals are not supported on Base mainnet.</p>;
  }
  if (availability === 'missing-contract') {
    return <p className="text-xs text-rose-400">Planet reveal is unavailable: contract configuration is missing.</p>;
  }
  if (availability === 'wrong-chain') {
    return <p className="text-xs text-amber-200">Switch your wallet to Base Sepolia to reveal this planet.</p>;
  }
  if (!isPlanetVoucherServiceConfigured) {
    return (
      <p className="text-xs text-zinc-500">
        Reveal will be enabled when the voucher service is configured.
      </p>
    );
  }
  if (logIndex === undefined) {
    return (
      <p className="text-xs text-zinc-500">
        This planet needs canonical ticket provenance before it can reveal.
      </p>
    );
  }
  if (!canMint)
    return (
      <p className="text-xs text-zinc-500">Connect a Base Sepolia wallet to reveal this planet.</p>
    );

  return (
    <div className="space-y-2">
      <Button
        onClick={() => void mint()}
        disabled={isPreparing || write.isPending || receipt.isLoading}
      >
        {isPreparing
          ? 'Preparing reveal…'
          : write.isPending || receipt.isLoading
            ? 'Revealing planet…'
            : (buttonLabel ?? 'Reveal planet')}
      </Button>
      <p className="text-xs text-amber-200">
        The server verifies ticket provenance and signs immutable IPFS metadata before your wallet
        submits the Base Sepolia mint.
      </p>
      <TxStatus
        hash={write.data}
        isPending={isPreparing || write.isPending || receipt.isLoading}
        isSuccess={receiptSucceeded}
        error={preparationError ?? write.error ?? receipt.error ?? receiptError}
      />
    </div>
  );
}
