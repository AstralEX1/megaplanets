import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sha256, toHex } from 'viem';
import { describe, expect, it, vi } from 'vitest';
import {
  GENERATOR_CONFIG_V1,
  derivePlanet,
  derivePlanetSeed,
  getPaletteWeights,
  getRarityRanges,
  normalizePlanetInput,
  renderPlanetFrame,
  renderPlanetGif,
  serializePlanetInput,
} from '../src';
import { GOLDEN_VECTORS } from './vectors';
import {
  createPlanetScene,
  isSatelliteBehind,
  renderPlanetSceneFrame,
} from '../src/render';

type GifInfo = {
  width: number;
  height: number;
  frames: number;
  durationMs: number;
  repeat: number;
};

function skipSubBlocks(bytes: Uint8Array, initialOffset: number): number {
  let offset = initialOffset;
  for (;;) {
    const length = bytes[offset] ?? 0;
    offset += 1;
    if (length === 0) return offset;
    offset += length;
  }
}

function inspectGif(bytes: Uint8Array): GifInfo {
  expect(new TextDecoder().decode(bytes.slice(0, 6))).toBe('GIF89a');
  const width = (bytes[6] ?? 0) | ((bytes[7] ?? 0) << 8);
  const height = (bytes[8] ?? 0) | ((bytes[9] ?? 0) << 8);
  const packed = bytes[10] ?? 0;
  let offset = 13 + ((packed & 0x80) === 0 ? 0 : 3 * 2 ** ((packed & 0x07) + 1));
  let frames = 0;
  let durationMs = 0;
  let repeat = -1;

  while (offset < bytes.length) {
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0x3b) break;
    if (marker === 0x21) {
      const label = bytes[offset];
      offset += 1;
      if (label === 0xf9) {
        const blockSize = bytes[offset] ?? 0;
        durationMs += ((bytes[offset + 2] ?? 0) | ((bytes[offset + 3] ?? 0) << 8)) * 10;
        offset += blockSize + 2;
      } else if (label === 0xff) {
        const blockSize = bytes[offset] ?? 0;
        const app = new TextDecoder().decode(bytes.slice(offset + 1, offset + 1 + blockSize));
        offset += blockSize + 1;
        if (app === 'NETSCAPE2.0' && bytes[offset] === 3 && bytes[offset + 1] === 1) {
          repeat = (bytes[offset + 2] ?? 0) | ((bytes[offset + 3] ?? 0) << 8);
        }
        offset = skipSubBlocks(bytes, offset);
      } else {
        offset = skipSubBlocks(bytes, offset);
      }
      continue;
    }
    if (marker === 0x2c) {
      frames += 1;
      const imagePacked = bytes[offset + 8] ?? 0;
      offset += 9;
      if ((imagePacked & 0x80) !== 0) offset += 3 * 2 ** ((imagePacked & 0x07) + 1);
      offset += 1;
      offset = skipSubBlocks(bytes, offset);
      continue;
    }
    throw new Error(`Unexpected GIF block 0x${(marker ?? 0).toString(16)}.`);
  }
  return { width, height, frames, durationMs, repeat };
}

function rgbDistance(first: `#${string}`, second: `#${string}`): number {
  const rgb = (color: `#${string}`) => [
    Number.parseInt(color.slice(1, 3), 16),
    Number.parseInt(color.slice(3, 5), 16),
    Number.parseInt(color.slice(5, 7), 16),
  ];
  const [firstRed, firstGreen, firstBlue] = rgb(first);
  const [secondRed, secondGreen, secondBlue] = rgb(second);
  return Math.hypot(firstRed - secondRed, firstGreen - secondGreen, firstBlue - secondBlue);
}

describe('canonical planet seed', () => {
  it.each(GOLDEN_VECTORS)('matches $name', ({ input, seed }) => {
    expect(derivePlanetSeed(input)).toBe(seed);
  });

  it('normalizes normal balls before hashing', () => {
    const input = GOLDEN_VECTORS[0]?.input;
    if (!input) throw new Error('Missing seed fixture.');
    expect(derivePlanetSeed({ ...input, normals: [29, 2, 22, 7, 14] })).toBe(
      GOLDEN_VECTORS[0]?.seed,
    );
  });

  it('rejects invalid canonical input', () => {
    expect(() =>
      normalizePlanetInput({ ticketId: 0n, drawingId: 1n, normals: [1, 2, 3, 4, 5], bonusBall: 1 }),
    ).toThrow();
    expect(() =>
      normalizePlanetInput({ ticketId: 1n, drawingId: 1n, normals: [1, 1, 3, 4, 5], bonusBall: 1 }),
    ).toThrow();
    expect(() =>
      normalizePlanetInput({ ticketId: 1n, drawingId: 1n, normals: [1, 2, 3, 4], bonusBall: 1 }),
    ).toThrow();
  });
});

describe('versioned traits and points', () => {
  it('rotates a complete weighted palette distribution for every bonus profile', () => {
    const profiles = Array.from({ length: 6 }, (_, index) => getPaletteWeights(index + 1));
    expect(profiles).toEqual([
      [15, 10, 6, 4, 1, 6],
      [6, 15, 10, 6, 4, 1],
      [1, 6, 15, 10, 6, 4],
      [4, 1, 6, 15, 10, 6],
      [6, 4, 1, 6, 15, 10],
      [10, 6, 4, 1, 6, 15],
    ]);
    expect(profiles.every((profile) => profile.every((weight) => weight > 0))).toBe(true);
  });

  it('caps ranges by drawing id and normalizes by removing empty ranges', () => {
    expect(getRarityRanges(1n)).toEqual([{ rarity: '42', min: 1n, max: 1n, weight: 1 }]);
    expect(getRarityRanges(251n).map((range) => [range.rarity, range.min, range.max])).toEqual([
      ['Common', 1n, 100n],
      ['Uncommon', 101n, 250n],
      ['42', 251n, 251n],
    ]);
    expect(getRarityRanges(1_000n).map((range) => range.rarity)).toEqual([
      'Common',
      'Uncommon',
      'Rare',
      'Legendary',
      '42',
    ]);
  });

  it('keeps points within the selected rarity and drawing cap', () => {
    for (const { input } of GOLDEN_VECTORS) {
      const planet = derivePlanet(input);
      const range = getRarityRanges(input.drawingId).find(
        (candidate) => candidate.rarity === planet.rarity,
      );
      expect(range).toBeDefined();
      expect(planet.dailyPoints >= (range?.min ?? 0n)).toBe(true);
      expect(planet.dailyPoints <= (range?.max ?? 0n)).toBe(true);
      expect(planet.dailyPoints <= input.drawingId).toBe(true);
      expect(planet.traits.specialEditionId).toBeNull();
    }
  });

  it('does not consult Math.random', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be used');
    });
    const descriptor = derivePlanet(GOLDEN_VECTORS[0]?.input as never);
    renderPlanetFrame(descriptor, 0);
    random.mockRestore();
  });

  it('derives dedicated high-contrast satellite colors', () => {
    for (const { input } of GOLDEN_VECTORS) {
      const traits = derivePlanet(input).traits;
      const surfaceColors = [
        ...traits.colors.planet.filter((color): color is `#${string}` => color !== null),
        ...traits.colors.cloud,
      ];
      for (const satelliteColor of traits.colors.satellite) {
        expect(
          Math.min(...surfaceColors.map((surface) => rgbDistance(satelliteColor, surface))),
        ).toBeGreaterThanOrEqual(90);
      }
      expect(rgbDistance(traits.colors.satellite[0], traits.colors.satellite[1])).toBeGreaterThanOrEqual(90);
    }
  });
});

describe('golden renderer outputs', () => {
  const fixtureDirectory = fileURLToPath(new URL('./fixtures/', import.meta.url));
  const manifest = JSON.parse(readFileSync(`${fixtureDirectory}manifest.json`, 'utf8')) as Array<
    Record<string, unknown>
  >;

  it.each(GOLDEN_VECTORS)('reproduces $name byte-for-byte', ({ name, input }) => {
    const descriptor = derivePlanet(input);
    const firstFrame = renderPlanetFrame(descriptor, 0);
    const middleFrame = renderPlanetFrame(descriptor, GENERATOR_CONFIG_V1.durationMs / 2);
    const gif = renderPlanetGif(descriptor);
    const actual = {
      name,
      input: serializePlanetInput(input),
      seed: descriptor.seed,
      dailyPoints: descriptor.dailyPoints.toString(),
      rarity: descriptor.rarity,
      canonicalTraitsJson: descriptor.canonicalTraitsJson,
      traitsHash: descriptor.traitsHash,
      firstFrameSha256: sha256(toHex(new Uint8Array(firstFrame.data.buffer))),
      middleFrameSha256: sha256(toHex(new Uint8Array(middleFrame.data.buffer))),
      gifSha256: sha256(toHex(gif)),
      gifBytes: gif.length,
    };
    expect(actual).toEqual(manifest.find((entry) => entry.name === name));
    expect(gif).toEqual(new Uint8Array(readFileSync(`${fixtureDirectory}${name}.gif`)));
    expect(inspectGif(gif)).toEqual({
      width: 512,
      height: 512,
      frames: 144,
      durationMs: 12_000,
      repeat: 0,
    });
  });

  it('closes every animated layer at the infinite-loop boundary', () => {
    const descriptor = derivePlanet(GOLDEN_VECTORS[0]?.input as never);
    const scene = createPlanetScene(descriptor);
    const first = renderPlanetSceneFrame(scene, 0, GENERATOR_CONFIG_V1.durationMs);
    const loopBoundary = renderPlanetSceneFrame(
      scene,
      GENERATOR_CONFIG_V1.durationMs,
      GENERATOR_CONFIG_V1.durationMs,
    );
    expect(loopBoundary.data).toEqual(first.data);
  });

  it('switches satellite depth at the horizontal orbit axis like the source generator', () => {
    expect(isSatelliteBehind(Math.PI / 2)).toBe(false);
    expect(isSatelliteBehind((Math.PI * 3) / 2)).toBe(true);
  });

  it('changes both the seed and rendered output when drawingId changes', () => {
    const input = GOLDEN_VECTORS[0]?.input;
    if (!input) throw new Error('Missing seed fixture.');
    const first = derivePlanet(input);
    const second = derivePlanet({ ...input, drawingId: input.drawingId + 1n });
    expect(second.seed).not.toBe(first.seed);
    expect(sha256(toHex(new Uint8Array(renderPlanetFrame(second, 0).data.buffer)))).not.toBe(
      sha256(toHex(new Uint8Array(renderPlanetFrame(first, 0).data.buffer))),
    );
  });
});
