/**
 * ---
 * @skill      https://llms.megapot.io/tasks/buy-tickets
 * @contract   USDC.allowance
 * @customize  Read the user's USDC allowance for a specific spender. Used by
 *             ERC-20 approval flows to decide whether an `approve` tx is
 *             needed before the next ticket purchase or batch order write.
 *             Pair with `useUsdcBalance` when both balance + allowance are
 *             needed; the two queries dedupe via wagmi/TanStack query keys.
 * ---
 */
import { erc20Abi } from 'viem';
import { useReadContract } from 'wagmi';
import { USDC_ADDRESS } from '@/config/contracts';

export function useUsdcAllowance(
  user: `0x${string}` | undefined,
  spender: `0x${string}` | undefined,
) {
  const { data, error, isLoading, refetch } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: user && spender ? [user, spender] : undefined,
    query: { enabled: !!user && !!spender },
  });

  return {
    allowance: data,
    error,
    isLoading,
    refetch,
  };
}
