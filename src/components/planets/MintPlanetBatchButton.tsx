import { useEffect, useMemo, useRef, useState } from 'react';
import { useAccount, useChainId, usePublicClient, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import type { PlanetPreview } from '@megaplanets/planet-generator';
import { Button } from '@/components/common/Button';
import { TxStatus } from '@/components/common/TxStatus';
import { CHAIN, MEGAPLANETS_CONTRACT_ADDRESS } from '@/config/contracts';
import { megaPlanetsAbi } from '@/lib/megaPlanets';
import { isPlanetVoucherServiceConfigured, requestPlanetVoucher } from '@/lib/planetVoucher';
import { getTransactionReceiptError, isSuccessfulTransactionReceipt } from '@/lib/transactionReceipt';
import { getPlanetAvailability } from '@/lib/planetAvailability';
import { baseSepolia } from 'viem/chains';

type MintablePlanet = { preview: PlanetPreview; logIndex: bigint | undefined };

export function MintPlanetBatchButton({
  planets,
  buttonLabel,
  onMinted,
  onStateChange,
}: {
  planets: readonly MintablePlanet[];
  buttonLabel?: string;
  onMinted?: (ticketIds: readonly bigint[]) => void;
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
  const validPlanets = useMemo(
    () => planets.filter((planet) => planet.logIndex !== undefined).slice(0, 50),
    [planets],
  );
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
    validPlanets.length === planets.length &&
    validPlanets.length > 1 &&
    isPlanetVoucherServiceConfigured;

  useEffect(() => {
    if (!receiptSucceeded) {
      hasNotifiedMint.current = false;
      return;
    }
    if (hasNotifiedMint.current) return;
    hasNotifiedMint.current = true;
    onMinted?.(validPlanets.map(({ preview }) => preview.descriptor.input.ticketId));
  }, [onMinted, receiptSucceeded, validPlanets]);

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

  const mintBatch = async () => {
    if (!canMint || !address || !publicClient || !MEGAPLANETS_CONTRACT_ADDRESS) return;
    setPreparationError(null);
    setIsPreparing(true);
    try {
      const prepared = await Promise.all(
        validPlanets.map(({ preview, logIndex }) =>
          requestPlanetVoucher({
            transactionHash: preview.descriptor.input.originTxHash,
            logIndex: logIndex as bigint,
          }),
        ),
      );
      if (prepared.some(({ voucher }) => voucher.recipient.toLowerCase() !== address.toLowerCase()))
        throw new Error('A voucher recipient does not match the connected wallet.');
      const simulation = await publicClient.simulateContract({
        account: address,
        address: MEGAPLANETS_CONTRACT_ADDRESS,
        abi: megaPlanetsAbi,
        functionName: 'mintBatch',
        args: [prepared.map(({ voucher }) => voucher), prepared.map(({ signature }) => signature)],
      });
      write.writeContract(simulation.request);
    } catch (error) {
      setPreparationError(
        error instanceof Error ? error : new Error('Planet batch mint preparation failed.'),
      );
    } finally {
      setIsPreparing(false);
    }
  };

  if (planets.length < 2) return null;
  if (availability === 'unsupported-mainnet')
    return <p className="text-xs text-zinc-500">Planet reveals are not supported on Base mainnet.</p>;
  if (availability === 'missing-contract')
    return <p className="text-xs text-rose-400">Planet reveal is unavailable: contract configuration is missing.</p>;
  if (availability === 'wrong-chain')
    return <p className="text-xs text-amber-200">Switch your wallet to Base Sepolia to reveal these planets.</p>;
  if (!isPlanetVoucherServiceConfigured)
    return (
      <p className="text-xs text-zinc-500">
        Reveal will be enabled when the voucher service is configured.
      </p>
    );
  if (planets.length > 50)
    return <p className="text-xs text-zinc-500">Reveal up to 50 planets at a time.</p>;
  if (!canMint)
    return (
      <p className="text-xs text-zinc-500">
        Connect a Base Sepolia wallet to reveal these planets.
      </p>
    );

  return (
    <div className="space-y-2">
      <Button
        onClick={() => void mintBatch()}
        disabled={isPreparing || write.isPending || receipt.isLoading}
      >
        {isPreparing
          ? 'Preparing reveal…'
          : write.isPending || receipt.isLoading
            ? 'Revealing planets…'
            : (buttonLabel ?? `Reveal all ${planets.length} planets`)}
      </Button>
      <TxStatus
        hash={write.data}
        isPending={isPreparing || write.isPending || receipt.isLoading}
        isSuccess={receiptSucceeded}
        error={preparationError ?? write.error ?? receipt.error ?? receiptError}
      />
    </div>
  );
}
