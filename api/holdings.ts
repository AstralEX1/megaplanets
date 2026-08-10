import { createPublicClient, getAddress, http, type Address } from 'viem';
import { baseSepolia } from 'viem/chains';
import type { Stage5Config } from './config';
import type { PlanetHolding } from './scoring';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;
const ERC721_ABI = [
  { type: 'event', name: 'Transfer', inputs: [{ indexed: true, name: 'from', type: 'address' }, { indexed: true, name: 'to', type: 'address' }, { indexed: true, name: 'tokenId', type: 'uint256' }] },
  { type: 'function', name: 'tokenURI', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'string' }] },
] as const;

export type PlanetTransfer = { from: Address; to: Address; tokenId: bigint; blockNumber: bigint; logIndex: bigint };
type PlanetMetadata = { attributes?: unknown };

function isZeroAddress(address: Address): boolean {
  return address.toLowerCase() === ZERO_ADDRESS;
}

/** Applies the complete ERC-721 transfer history up to one block, yielding the owner at that block. */
export function reconstructPlanetOwners(transfers: readonly PlanetTransfer[]): ReadonlyMap<bigint, Address> {
  const owners = new Map<bigint, Address>();
  const ordered = [...transfers].sort((left, right) => left.blockNumber === right.blockNumber ? left.logIndex === right.logIndex ? 0 : left.logIndex < right.logIndex ? -1 : 1 : left.blockNumber < right.blockNumber ? -1 : 1);
  for (const transfer of ordered) {
    if (transfer.tokenId < 0n || transfer.blockNumber < 0n || transfer.logIndex < 0n) throw new Error('Planet transfer has an invalid position.');
    const from = getAddress(transfer.from);
    const to = getAddress(transfer.to);
    const currentOwner = owners.get(transfer.tokenId);
    if (!isZeroAddress(from) && currentOwner?.toLowerCase() !== from.toLowerCase()) throw new Error(`Planet ${transfer.tokenId} transfer history is inconsistent.`);
    if (isZeroAddress(to)) owners.delete(transfer.tokenId);
    else owners.set(transfer.tokenId, to);
  }
  return owners;
}

/** Extracts the immutable scoring fields from canonical Planet metadata. */
export function parsePlanetMetadata(value: unknown): { planetType: string; minerals: bigint } {
  if (!value || typeof value !== 'object' || !Array.isArray((value as PlanetMetadata).attributes)) throw new Error('Planet metadata has no attributes array.');
  const attributes = (value as { attributes: unknown[] }).attributes;
  const type = attributes.find((attribute) => attribute && typeof attribute === 'object' && (attribute as { trait_type?: unknown }).trait_type === 'Type') as { value?: unknown } | undefined;
  const minerals = attributes.find((attribute) => attribute && typeof attribute === 'object' && (attribute as { trait_type?: unknown }).trait_type === 'Minerals') as { value?: unknown } | undefined;
  if (!type || typeof type.value !== 'string' || !type.value.trim()) throw new Error('Planet metadata Type attribute is invalid.');
  if (!minerals || (typeof minerals.value !== 'number' && typeof minerals.value !== 'string')) throw new Error('Planet metadata Minerals attribute is invalid.');
  const amount = typeof minerals.value === 'number' ? Number.isSafeInteger(minerals.value) ? BigInt(minerals.value) : -1n : /^\d+$/.test(minerals.value) ? BigInt(minerals.value) : -1n;
  if (amount < 0n) throw new Error('Planet metadata Minerals attribute is invalid.');
  return { planetType: type.value.trim(), minerals: amount };
}

function metadataGatewayUrl(uri: string): string {
  if (!uri.startsWith('ipfs://')) throw new Error('Planet token URI must use ipfs://.');
  return `https://gateway.pinata.cloud/ipfs/${uri.slice('ipfs://'.length)}`;
}

/** Reads immutable token metadata and current ERC-721 ownership at a recorded Base Sepolia block. */
export async function getPlanetHoldingsAtBlock(config: Stage5Config, blockNumber: bigint): Promise<PlanetHolding[]> {
  const planetContractAddress = config.planetContractAddress;
  const planetDeploymentBlock = config.planetDeploymentBlock;
  if (!planetContractAddress || planetDeploymentBlock === undefined) throw new Error('MEGAPLANETS_CONTRACT_ADDRESS and MEGAPLANETS_PLANET_DEPLOYMENT_BLOCK are required for holder snapshots.');
  const client = createPublicClient({ chain: baseSepolia, transport: http(config.rpcUrl) });
  const logs = await client.getLogs({ address: planetContractAddress, event: ERC721_ABI[0], fromBlock: planetDeploymentBlock, toBlock: blockNumber });
  const owners = reconstructPlanetOwners(logs.map((log) => {
    if (!log.args.from || !log.args.to || log.args.tokenId === undefined || log.blockNumber === null || log.logIndex === null) throw new Error('Planet Transfer log is incomplete.');
    return { from: log.args.from, to: log.args.to, tokenId: log.args.tokenId, blockNumber: log.blockNumber, logIndex: BigInt(log.logIndex) };
  }));
  return Promise.all([...owners.entries()].map(async ([tokenId, holder]) => {
    const uri = await client.readContract({ address: planetContractAddress, abi: ERC721_ABI, functionName: 'tokenURI', args: [tokenId], blockNumber });
    const response = await fetch(metadataGatewayUrl(uri));
    if (!response.ok) throw new Error(`Planet metadata fetch failed (${response.status}).`);
    return { holder, tokenId, ...parsePlanetMetadata(await response.json()) };
  }));
}
