import {
  buildPlanetMetadata,
  createPlanetConfig,
  derivePlanet,
  derivePlanetPreview,
} from '@megaplanets/planet-generator';
import { renderPlanetWebM } from '@megaplanets/planet-generator/server';
import { getAddress, isAddress, isHash, keccak256, stringToHex } from 'viem';
import type { Stage5Config } from './config';
import type { EligibleTicket } from './eligibility';
import { pinJson, pinWebM } from './pinata';
import type { PlanetArtifact } from './store';
import { signMintVoucher } from './voucher';

function isIpfsUri(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith('ipfs://') &&
    value.length > 'ipfs://'.length &&
    !/\s/.test(value)
  );
}

/**
 * Revalidates immutable media and deterministic Planet fields before reusing a
 * cached artifact. The bytes behind an IPFS media CID cannot be verified
 * without an external fetch, so this check intentionally covers the
 * deterministically verifiable URI/hash shape and metadata URI hash only.
 */
function assertArtifactMatchesProof(
  artifact: PlanetArtifact,
  ticket: EligibleTicket,
  descriptor: ReturnType<typeof derivePlanet>,
): void {
  const expectedKey = `${ticket.originTxHash.toLowerCase()}:${ticket.logIndex.toString()}`;
  if (typeof artifact.key !== 'string' || artifact.key !== expectedKey) {
    throw new Error('Immutable Planet artifact key does not match Megastera Proof.');
  }
  if (typeof artifact.ticketId !== 'string' || artifact.ticketId !== ticket.ticketId.toString()) {
    throw new Error('Immutable Planet artifact ticket does not match Megastera Proof.');
  }
  if (
    !isAddress(artifact.recipient) ||
    getAddress(artifact.recipient) !== getAddress(ticket.recipient)
  ) {
    throw new Error('Immutable Planet artifact recipient does not match Megastera Proof.');
  }
  if (!isHash(artifact.seed) || artifact.seed.toLowerCase() !== descriptor.seed.toLowerCase()) {
    throw new Error(
      'Immutable Planet artifact seed does not match the canonical Planet descriptor.',
    );
  }
  if (
    !isHash(artifact.traitsHash) ||
    artifact.traitsHash.toLowerCase() !== descriptor.traitsHash.toLowerCase()
  ) {
    throw new Error(
      'Immutable Planet artifact traits hash does not match the canonical Planet descriptor.',
    );
  }
  if (!isIpfsUri(artifact.metadataURI) || !isHash(artifact.metadataHash)) {
    throw new Error('Immutable Planet artifact metadata URI or hash is malformed.');
  }
  const expectedMetadataHash = keccak256(stringToHex(artifact.metadataURI));
  if (artifact.metadataHash.toLowerCase() !== expectedMetadataHash.toLowerCase()) {
    throw new Error('Immutable Planet artifact metadata hash does not match its URI.');
  }
  if (!isIpfsUri(artifact.mediaURI) || !isHash(artifact.mediaHash)) {
    throw new Error('Immutable Planet artifact media URI or hash is malformed.');
  }
}

export async function prepareVoucher(
  config: Stage5Config,
  ticket: EligibleTicket,
  existingArtifactOrNow?: PlanetArtifact | bigint,
  now = BigInt(Math.floor(Date.now() / 1000)),
) {
  // Preserve the pre-cache third-argument `now` call shape for direct callers
  // while allowing the API route to pass an immutable artifact.
  const existingArtifact =
    typeof existingArtifactOrNow === 'bigint' ? undefined : existingArtifactOrNow;
  const effectiveNow = typeof existingArtifactOrNow === 'bigint' ? existingArtifactOrNow : now;
  const input = {
    ticketId: ticket.ticketId,
    drawingId: ticket.drawingId,
    normals: ticket.normals,
    bonusBall: ticket.bonusBall,
    originTxHash: ticket.originTxHash,
  } as const;
  const planetConfig = createPlanetConfig();
  const descriptor = derivePlanet(input, planetConfig);
  const metadata = buildPlanetMetadata(descriptor, planetConfig);
  if (existingArtifact) {
    assertArtifactMatchesProof(existingArtifact, ticket, descriptor);
    return signMintVoucher(config, {
      recipient: ticket.recipient,
      ticketId: ticket.ticketId,
      drawingId: ticket.drawingId,
      originTxHash: ticket.originTxHash,
      seed: existingArtifact.seed,
      traitsHash: existingArtifact.traitsHash,
      metadataHash: existingArtifact.metadataHash,
      metadataURI: existingArtifact.metadataURI,
      expiresAt: effectiveNow + 3600n,
    });
  }
  const webm = await renderPlanetWebM(derivePlanetPreview(input, planetConfig).visual);
  const media = await pinWebM(config.pinataJwt, `megaplanet-${ticket.ticketId}.webm`, webm);
  const mediaHash = keccak256(webm);
  const pinned = await pinJson(config.pinataJwt, `megaplanet-${ticket.ticketId}.json`, {
    ...metadata,
    animation_url: media.uri,
    mediaType: 'video/webm',
    mediaHash,
  });
  const artifact: PlanetArtifact = {
    key: `${ticket.originTxHash.toLowerCase()}:${ticket.logIndex.toString()}`,
    ticketId: ticket.ticketId.toString(),
    recipient: ticket.recipient,
    seed: descriptor.seed,
    traitsHash: descriptor.traitsHash,
    metadataHash: keccak256(stringToHex(pinned.uri)),
    metadataURI: pinned.uri,
    mediaURI: media.uri,
    mediaHash,
  };
  const prepared = await signMintVoucher(config, {
    recipient: ticket.recipient,
    ticketId: ticket.ticketId,
    drawingId: ticket.drawingId,
    originTxHash: ticket.originTxHash,
    seed: descriptor.seed,
    traitsHash: descriptor.traitsHash,
    metadataHash: artifact.metadataHash,
    metadataURI: artifact.metadataURI,
    expiresAt: effectiveNow + 3600n,
  });
  return { ...prepared, artifact };
}
