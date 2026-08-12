import { useEffect, useRef, useState } from 'react';
import { useAccount, usePublicClient, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import type { PlanetPreview } from '@megaplanets/planet-generator';
import { Button } from '@/components/common/Button';
import { TxStatus } from '@/components/common/TxStatus';
import { CHAIN, MEGAPLANETS_CONTRACT_ADDRESS } from '@/config/contracts';
import { megaPlanetsAbi } from '@/lib/megaPlanets';
import { isPlanetVoucherServiceConfigured, requestPlanetVoucher } from '@/lib/planetVoucher';
import { getTransactionReceiptError, isSuccessfulTransactionReceipt } from '@/lib/transactionReceipt';

export function MintPlanetButton({
  preview,
  logIndex,
  buttonLabel,
  onMinted,
  onStateChange,
}: {
  preview: PlanetPreview;
  logIndex: bigint | undefined;
  buttonLabel?: string;
  onMinted?: (ticketId: bigint) => void;
  onStateChange?: (
    state: 'idle' | 'wallet-confirmation' | 'confirming' | 'complete' | 'error',
  ) => void;
}) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const write = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: write.data });
  const receiptSucceeded = isSuccessfulTransactionReceipt(receipt.data);
  const receiptError = getTransactionReceiptError(receipt.data);
  const hasNotifiedMint = useRef(false);
  const [preparationError, setPreparationError] = useState<Error | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const canMint =
    CHAIN === 'testnet' &&
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
