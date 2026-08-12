import { keccak256, stringToHex } from 'viem';
import { buildPlanetMetadata, createPlanetConfig, derivePlanet, derivePlanetPreview } from '@megaplanets/planet-generator';
import { renderPlanetWebM } from '@megaplanets/planet-generator/server';
import type { Stage5Config } from './config';
import type { EligibleTicket } from './eligibility';
import { pinJson, pinWebM } from './pinata';
import { signMintVoucher } from './voucher';
import type { PlanetArtifact } from './store';

export async function prepareVoucher(
  config: Stage5Config,
  ticket: EligibleTicket,
  existingArtifactOrNow?: PlanetArtifact | bigint,
  now = BigInt(Math.floor(Date.now() / 1000)),
) {
  // Preserve the pre-cache third-argument `now` call shape for direct callers
  // while allowing the API route to pass an immutable artifact.
  const existingArtifact = typeof existingArtifactOrNow === 'bigint' ? undefined : existingArtifactOrNow;
  const effectiveNow = typeof existingArtifactOrNow === 'bigint' ? existingArtifactOrNow : now;
  const input = { ticketId: ticket.ticketId, drawingId: ticket.drawingId, normals: ticket.normals, bonusBall: ticket.bonusBall, originTxHash: ticket.originTxHash } as const;
  const planetConfig = createPlanetConfig();
  const descriptor = derivePlanet(input, planetConfig);
  const metadata = buildPlanetMetadata(descriptor, planetConfig);
  if (existingArtifact) {
    if (existingArtifact.ticketId !== ticket.ticketId.toString() || existingArtifact.recipient.toLowerCase() !== ticket.recipient.toLowerCase()) throw new Error('Immutable Planet artifact does not match Megastera Proof.');
    return signMintVoucher(config, { recipient: ticket.recipient, ticketId: ticket.ticketId, drawingId: ticket.drawingId, originTxHash: ticket.originTxHash, seed: existingArtifact.seed, traitsHash: existingArtifact.traitsHash, metadataHash: existingArtifact.metadataHash, metadataURI: existingArtifact.metadataURI, expiresAt: effectiveNow + 3600n });
  }
  const webm = await renderPlanetWebM(derivePlanetPreview(input, planetConfig).visual);
  const media = await pinWebM(config.pinataJwt, `megaplanet-${ticket.ticketId}.webm`, webm);
  const mediaHash = keccak256(webm);
  const pinned = await pinJson(config.pinataJwt, `megaplanet-${ticket.ticketId}.json`, { ...metadata, animation_url: media.uri, mediaType: 'video/webm', mediaHash });
  const artifact: PlanetArtifact = { key: `${ticket.originTxHash.toLowerCase()}:${ticket.logIndex.toString()}`, ticketId: ticket.ticketId.toString(), recipient: ticket.recipient, seed: descriptor.seed, traitsHash: descriptor.traitsHash, metadataHash: keccak256(stringToHex(pinned.uri)), metadataURI: pinned.uri, mediaURI: media.uri, mediaHash };
  const prepared = await signMintVoucher(config, { recipient: ticket.recipient, ticketId: ticket.ticketId, drawingId: ticket.drawingId, originTxHash: ticket.originTxHash, seed: descriptor.seed, traitsHash: descriptor.traitsHash, metadataHash: artifact.metadataHash, metadataURI: artifact.metadataURI, expiresAt: effectiveNow + 3600n });
  return { ...prepared, artifact };
}
