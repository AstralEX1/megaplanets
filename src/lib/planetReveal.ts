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
export type RevealUnavailable = {
  planet: RevealCandidate;
  reason: 'already-minted' | 'burned' | 'transferred' | 'unreadable';
};

function isKnownMissingToken(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /erc721(?:a)?[^\n]*(?:nonexistent|invalid token)|owner query for nonexistent token|token does not exist/i.test(
    message,
  );
}

const planetMintedAbi = [
  {
    type: 'function',
    name: 'planetMinted',
    stateMutability: 'view',
    inputs: [{ name: 'ticketId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export async function getLiveRevealCandidates(
  client: Pick<PublicClient, 'readContract'>,
  recipient: Address,
  candidates: readonly RevealCandidate[],
  ticketNft: Address,
  planetContract?: Address,
) {
  const checks = await Promise.all(
    candidates.map(async (planet) => {
      try {
        const owner = await client.readContract({
          address: ticketNft,
          abi: ticketOwnerAbi,
          functionName: 'ownerOf',
          args: [planet.ticketId],
        });
        if (owner.toLowerCase() !== recipient.toLowerCase()) {
          return { planet, reason: 'transferred' as const };
        }
        if (planetContract) {
          const minted = await client.readContract({
            address: planetContract,
            abi: planetMintedAbi,
            functionName: 'planetMinted',
            args: [planet.ticketId],
          });
          if (minted) return { planet, reason: 'already-minted' as const };
        }
        return { planet, live: true as const };
      } catch (error) {
        const reason = isKnownMissingToken(error) ? 'burned' : 'unreadable';
        return { planet, reason } as const;
      }
    }),
  );
  const live = checks.flatMap((check) => (check.live ? [check.planet] : []));
  const unavailable = checks.flatMap((check) =>
    check.live ? [] : [{ planet: check.planet, reason: check.reason }],
  );
  return { live, unavailable };
}
