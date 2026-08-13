import { createPlanetConfig, derivePlanet } from '@megaplanets/planet-generator';
import { type Hex, keccak256, stringToHex } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Stage5Config } from './config';
import type { EligibleTicket } from './eligibility';
import type { PlanetArtifact } from './store';

vi.mock('@megaplanets/planet-generator/server', () => ({
  renderPlanetWebM: vi.fn(),
}));

vi.mock('./pinata', () => ({
  pinJson: vi.fn(),
  pinWebM: vi.fn(),
}));

import { renderPlanetWebM } from '@megaplanets/planet-generator/server';
import { pinJson, pinWebM } from './pinata';
import { prepareVoucher } from './service';

const config: Stage5Config = {
  rpcUrl: 'https://rpc.example.test',
  databaseUrl: 'postgresql://not-used.test',
  pinataJwt: 'test-token',
  signerPrivateKey: `0x${'11'.repeat(32)}`,
  launchBlock: 44_997_183n,
  planetContractAddress: `0x${'22'.repeat(20)}`,
};

const ticket: EligibleTicket = {
  recipient: `0x${'33'.repeat(20)}`,
  ticketId: 456n,
  drawingId: 123n,
  normals: [2, 7, 14, 22, 29],
  bonusBall: 9,
  originTxHash: `0x${'ab'.repeat(32)}`,
  blockNumber: 44_997_183n,
  logIndex: 4n,
};

const descriptor = derivePlanet(
  {
    ticketId: ticket.ticketId,
    drawingId: ticket.drawingId,
    normals: ticket.normals,
    bonusBall: ticket.bonusBall,
    originTxHash: ticket.originTxHash,
  },
  createPlanetConfig(),
);

const validArtifact = (): PlanetArtifact => ({
  key: `${ticket.originTxHash.toLowerCase()}:${ticket.logIndex.toString()}`,
  ticketId: ticket.ticketId.toString(),
  recipient: ticket.recipient,
  seed: descriptor.seed,
  traitsHash: descriptor.traitsHash,
  metadataHash: keccak256(stringToHex('ipfs://metadata-cid')),
  metadataURI: 'ipfs://metadata-cid',
  mediaURI: 'ipfs://media-cid',
  mediaHash: keccak256('0x010203'),
});

describe('prepareVoucher immutable artifact reuse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('re-signs an expired voucher from a valid artifact without rendering or pinning', async () => {
    const prepared = await prepareVoucher(config, ticket, validArtifact(), 2_000n);

    expect(prepared.voucher).toMatchObject({
      recipient: ticket.recipient,
      ticketId: ticket.ticketId,
      drawingId: ticket.drawingId,
      originTxHash: ticket.originTxHash,
      seed: descriptor.seed,
      traitsHash: descriptor.traitsHash,
      metadataHash: validArtifact().metadataHash,
      metadataURI: 'ipfs://metadata-cid',
      expiresAt: 5_600n,
    });
    expect(renderPlanetWebM).not.toHaveBeenCalled();
    expect(pinWebM).not.toHaveBeenCalled();
    expect(pinJson).not.toHaveBeenCalled();
  });

  it.each([
    [
      'key',
      (artifact: PlanetArtifact) => ({
        ...artifact,
        key: `${ticket.originTxHash.toLowerCase()}:99`,
      }),
    ],
    ['ticket ID', (artifact: PlanetArtifact) => ({ ...artifact, ticketId: '457' })],
    [
      'recipient',
      (artifact: PlanetArtifact) => ({
        ...artifact,
        recipient: `0x${'44'.repeat(20)}` as `0x${string}`,
      }),
    ],
    ['seed', (artifact: PlanetArtifact) => ({ ...artifact, seed: `0x${'01'.repeat(32)}` as Hex })],
    [
      'traits hash',
      (artifact: PlanetArtifact) => ({ ...artifact, traitsHash: `0x${'02'.repeat(32)}` as Hex }),
    ],
    [
      'metadata hash',
      (artifact: PlanetArtifact) => ({ ...artifact, metadataHash: `0x${'03'.repeat(32)}` as Hex }),
    ],
    [
      'metadata URI',
      (artifact: PlanetArtifact) => ({ ...artifact, metadataURI: 'ipfs://other-metadata' }),
    ],
    ['media URI', (artifact: PlanetArtifact) => ({ ...artifact, mediaURI: 'not-a-media-uri' })],
    ['media hash', (artifact: PlanetArtifact) => ({ ...artifact, mediaHash: '0x1234' as Hex })],
  ])('rejects an expired-voucher artifact with a mismatched %s', async (_field, mutate) => {
    await expect(prepareVoucher(config, ticket, mutate(validArtifact()), 2_000n)).rejects.toThrow(
      /artifact|metadata|media/i,
    );
    expect(renderPlanetWebM).not.toHaveBeenCalled();
    expect(pinWebM).not.toHaveBeenCalled();
    expect(pinJson).not.toHaveBeenCalled();
  });

  it('rejects metadata and media values that are malformed or not internally consistent', async () => {
    await expect(
      prepareVoucher(
        config,
        ticket,
        { ...validArtifact(), metadataURI: 'https://metadata.example' },
        2_000n,
      ),
    ).rejects.toThrow(/metadata/i);
    await expect(
      prepareVoucher(config, ticket, { ...validArtifact(), mediaURI: 'ipfs://' }, 2_000n),
    ).rejects.toThrow(/media/i);
    await expect(
      prepareVoucher(config, ticket, { ...validArtifact(), mediaHash: '0x' as Hex }, 2_000n),
    ).rejects.toThrow(/media/i);
    expect(renderPlanetWebM).not.toHaveBeenCalled();
  });
});
