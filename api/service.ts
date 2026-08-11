import { keccak256, stringToHex } from 'viem';
import { buildPlanetMetadata, createPlanetConfig, derivePlanet, derivePlanetPreview, renderPlanetGif } from '@megaplanets/planet-generator';
import type { Stage5Config } from './config';
import type { EligibleTicket } from './eligibility';
import { pinGif, pinJson } from './pinata';
import { signMintVoucher } from './voucher';

export async function prepareVoucher(config: Stage5Config, ticket: EligibleTicket, now = BigInt(Math.floor(Date.now() / 1000))) {
  const input = { ticketId: ticket.ticketId, drawingId: ticket.drawingId, normals: ticket.normals, bonusBall: ticket.bonusBall, originTxHash: ticket.originTxHash } as const;
  const planetConfig = createPlanetConfig();
  const descriptor = derivePlanet(input, planetConfig);
  const metadata = buildPlanetMetadata(descriptor, planetConfig);
  const gif = renderPlanetGif(derivePlanetPreview(input, planetConfig).visual);
  const image = await pinGif(config.pinataJwt, `megaplanet-${ticket.ticketId}.gif`, gif);
  const pinned = await pinJson(config.pinataJwt, `megaplanet-${ticket.ticketId}.json`, { ...metadata, image: image.uri, mediaHash: keccak256(gif) });
  return signMintVoucher(config, { recipient: ticket.recipient, ticketId: ticket.ticketId, drawingId: ticket.drawingId, originTxHash: ticket.originTxHash, seed: descriptor.seed, traitsHash: descriptor.traitsHash, metadataHash: keccak256(stringToHex(pinned.uri)), metadataURI: pinned.uri, expiresAt: now + 3600n });
}
