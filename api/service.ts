import { createPublicClient, http, keccak256, stringToHex, type Address } from 'viem';
import { baseSepolia } from 'viem/chains';
import { buildPlanetMetadata, createSeason1Config, derivePlanet, derivePlanetPreview, renderPlanetGif } from '@megaplanets/planet-generator';
import { SEASON_1_ID, type Stage5Config } from './config';
import { type EligibleTicket } from './eligibility';
import { pinGif, pinJson } from './pinata';
import { signMintVoucher } from './voucher';

const TICKET_NFT_ABI = [{ type: 'function', name: 'ownerOf', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'address' }] }] as const;

export async function prepareVoucher(config: Stage5Config, ticket: EligibleTicket, now = BigInt(Math.floor(Date.now() / 1000))) {
  const client = createPublicClient({ chain: baseSepolia, transport: http(config.rpcUrl) });
  const owner = await client.readContract({ address: '0x45084829ac63f9dC6a3D4981A46FA896f9180ECd', abi: TICKET_NFT_ABI, functionName: 'ownerOf', args: [ticket.ticketId] });
  if (owner.toLowerCase() !== ticket.recipient.toLowerCase()) throw new Error('Ticket is no longer owned by the eligible recipient.');
  const input = { seasonId: SEASON_1_ID, ticketId: ticket.ticketId, drawingId: ticket.drawingId, normals: ticket.normals, bonusBall: ticket.bonusBall, originTxHash: ticket.originTxHash } as const;
  const season = createSeason1Config(SEASON_1_ID);
  const descriptor = derivePlanet(input, season);
  const metadata = buildPlanetMetadata(descriptor, season);
  const gif = renderPlanetGif(derivePlanetPreview(input, season).visual);
  const image = await pinGif(config.pinataJwt, `megaplanet-${ticket.ticketId}.gif`, gif);
  const pinned = await pinJson(config.pinataJwt, `megaplanet-${ticket.ticketId}.json`, { ...metadata, image: image.uri, mediaHash: keccak256(gif) });
  return signMintVoucher(config, { recipient: ticket.recipient as Address, ticketId: ticket.ticketId, seasonId: SEASON_1_ID, drawingId: ticket.drawingId, originTxHash: ticket.originTxHash, seed: descriptor.seed, traitsHash: descriptor.traitsHash, metadataHash: keccak256(stringToHex(pinned.uri)), metadataURI: pinned.uri, expiresAt: now + 3600n });
}
