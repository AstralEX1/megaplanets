import type { Address, PublicClient } from 'viem';

const ticketOwnerAbi = [
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

export type RevealCandidate = { ticketId: bigint; logIndex: bigint };
export type RevealUnavailable = { planet: RevealCandidate; reason: 'burned' | 'transferred' | 'unreadable' };

function isOwnershipReadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return !/revert|nonexistent|erc721|not found/i.test(message);
}

export async function getLiveRevealCandidates(
  client: Pick<PublicClient, 'readContract'>,
  recipient: Address,
  candidates: readonly RevealCandidate[],
  ticketNft: Address,
) {
  const checks = await Promise.all(candidates.map(async (planet) => {
    try {
      const owner = await client.readContract({
        address: ticketNft,
        abi: ticketOwnerAbi,
        functionName: 'ownerOf',
        args: [planet.ticketId],
      });
      return owner.toLowerCase() === recipient.toLowerCase()
        ? { planet, live: true as const }
        : { planet, reason: 'transferred' as const };
    } catch (error) {
      const reason = isOwnershipReadError(error) ? 'unreadable' : 'burned';
      return { planet, reason } as const;
    }
  }));
  const live = checks.flatMap((check) => check.live ? [check.planet] : []);
  const unavailable = checks.flatMap((check) => check.live ? [] : [{ planet: check.planet, reason: check.reason }]);
  return { live, unavailable };
}
