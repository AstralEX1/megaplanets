import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sha256, toHex } from 'viem';
import { describe, expect, it, vi } from 'vitest';
import {
  buildPlanetMetadata,
  createPlanetConfig,
  createTerrainNoiseSampler,
  deriveOriginalCavityColors,
  derivePlanet,
  derivePlanetName,
  derivePlanetPreview,
  derivePlanetPreviewForType,
  derivePlanetSeed,
  deriveTypePalette,
  deriveTypeSatellites,
  deriveTypeTerrain,
  deserializePlanetDescriptor,
  GENERATOR_CONFIG,
  getTypeProfile,
  normalizePlanetInput,
  renderPlanetFrame,
  renderPlanetGif,
  PLANET_RARITY_CONFIG,
  PLANET_TYPE_WEIGHT_PROFILES,
  PLANET_TYPE_CONFIGS,
  serializePlanetDescriptor,
  serializePlanetInput,
  validatePlanetConfig,
} from '../src';
import { GOLDEN_VECTORS } from './golden-vectors';

function skipGifSubBlocks(bytes: Uint8Array, initialOffset: number): number {
  let offset = initialOffset;
  for (;;) {
    const length = bytes[offset] ?? 0;
    offset += 1;
    if (length === 0) return offset;
    offset += length;
  }
}

function inspectGif(bytes: Uint8Array) {
  expect(new TextDecoder().decode(bytes.slice(0, 6))).toBe('GIF89a');
  const width = (bytes[6] ?? 0) | ((bytes[7] ?? 0) << 8);
  const height = (bytes[8] ?? 0) | ((bytes[9] ?? 0) << 8);
  const packed = bytes[10] ?? 0;
  let offset = 13 + ((packed & 0x80) === 0 ? 0 : 3 * 2 ** ((packed & 0x07) + 1));
  let frames = 0;
  let durationMs = 0;
  let repeat = -1;
  while (offset < bytes.length) {
    const marker = bytes[offset++];
    if (marker === 0x3b) break;
    if (marker === 0x21) {
      const label = bytes[offset++];
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
        offset = skipGifSubBlocks(bytes, offset);
      } else {
        offset = skipGifSubBlocks(bytes, offset);
      }
      continue;
    }
    if (marker === 0x2c) {
      frames += 1;
      const imagePacked = bytes[offset + 8] ?? 0;
      offset += 9;
      if ((imagePacked & 0x80) !== 0) offset += 3 * 2 ** ((imagePacked & 0x07) + 1);
      offset += 1;
      offset = skipGifSubBlocks(bytes, offset);
      continue;
    }
    throw new Error(`Unexpected GIF block 0x${(marker ?? 0).toString(16)}.`);
  }
  return { width, height, frames, durationMs, repeat };
}

const ORIGIN_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const;
const ORIGIN_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as const;

const CONFIG = createPlanetConfig();
const INPUT = {
  ticketId: 456n,
  drawingId: 123n,
  normals: [29, 7, 22, 2, 14],
  bonusBall: 9,
  originTxHash: ORIGIN_A,
} as const;

describe('generator canonical seed', () => {
  it('normalizes normals and ABI-encodes all identity inputs', () => {
    expect(normalizePlanetInput(INPUT).normals).toEqual([2, 7, 14, 22, 29]);
    expect(derivePlanetSeed(INPUT)).toBe(
      '0x278d8d88d58248dd1db8a97efb860b26eb670b532f73fac2df2421479b76731e',
    );
    expect(derivePlanetSeed({ ...INPUT, normals: [2, 7, 14, 22, 29] })).toBe(
      '0x278d8d88d58248dd1db8a97efb860b26eb670b532f73fac2df2421479b76731e',
    );
    expect(derivePlanetSeed({ ...INPUT, originTxHash: ORIGIN_B })).toBe(
      '0xaefff91061635db3f689a67a8f41debc2ae684eb7515066141f45a9b6f8abb56',
    );
    expect(derivePlanetSeed({ ...INPUT, ticketId: 457n })).toBe(
      '0x6bd7f12837b50602a3a339a4930ac93d32ec2879986e1567a2b22bf1396a6ad4',
    );
  });

  it('rejects invalid bytes32 and canonical input', () => {
    expect(() => normalizePlanetInput({ ...INPUT, originTxHash: '0x1234' })).toThrow(/bytes32/);
    expect(() => normalizePlanetInput({ ...INPUT, normals: [2, 2, 14, 22, 29] })).toThrow(/unique/);
  });

  it('canonicalizes bytes32 casing and drops unexpected runtime input properties', () => {
    const normalized = normalizePlanetInput({
      ...INPUT,
      originTxHash: ORIGIN_A.toUpperCase().replace('0X', '0x') as `0x${string}`,
      injected: 'not-canonical',
    } as unknown as typeof INPUT);
    expect(normalized.originTxHash).toBe(ORIGIN_A);
    expect('injected' in normalized).toBe(false);
  });
});

describe('generator Planet traits', () => {
  it('gives the bonus-ball Type 55% weight and every other Type 5%', () => {
    for (let bonusBall = 1; bonusBall <= 24; bonusBall += 1) {
      const profile = getTypeProfile(CONFIG, bonusBall);
      expect(profile).toBe(
        PLANET_TYPE_WEIGHT_PROFILES[(bonusBall - 1) % PLANET_TYPE_WEIGHT_PROFILES.length],
      );
      expect(profile.weights.filter((weight) => weight === 55)).toHaveLength(1);
      expect(profile.weights.filter((weight) => weight === 5)).toHaveLength(9);
    }
  });

  it('rejects Type profile weight drift and validates Planet rarity configuration', () => {
    expect(() =>
      validatePlanetConfig({
        ...CONFIG,
        typeWeightProfiles: CONFIG.typeWeightProfiles.map((profile, index) =>
          index === 0 ? { ...profile, weights: [55, 6, 5, 5, 5, 5, 5, 5, 5, 4] } : profile,
        ),
      }),
    ).toThrow(/matching Type 55/);
    expect(
      PLANET_RARITY_CONFIG.map(({ rarity, weight, min, max }) => [rarity, weight, min, max]),
    ).toEqual([
      ['Common', 70, 10, 39],
      ['Uncommon', 20, 40, 79],
      ['Epic', 9, 80, 159],
      ['Legendary', 1, 160, 320],
    ]);
  });

  it('freezes canonical configuration and rejects drift in weights and mineral coverage', () => {
    expect(Object.isFrozen(CONFIG)).toBe(true);
    expect(Object.isFrozen(CONFIG.types)).toBe(true);
    expect(Object.isFrozen(CONFIG.types[0]?.visual.paletteVariants)).toBe(true);
    expect(() => {
      (CONFIG.types as unknown as { publicName: string }[])[0] = { publicName: 'Mutated' };
    }).toThrow();
    expect(() =>
      validatePlanetConfig({
        ...CONFIG,
        rarity: CONFIG.rarity.map((entry) =>
          entry.rarity === 'Common' ? { ...entry, weight: 69 } : entry,
        ),
      }),
    ).toThrow(/canonical configuration/);
    expect(() =>
      validatePlanetConfig({
        ...CONFIG,
        rarity: CONFIG.rarity.map((entry) =>
          entry.rarity === 'Common'
            ? {
                ...entry,
                subranges: [
                  { min: 10, max: 18, weight: 1 },
                  { min: 20, max: 39, weight: 1 },
                ],
              }
            : entry,
        ),
      }),
    ).toThrow(/without gaps or overlap/);
  });

  it('freezes ten cosmic Types with Coolors-sourced palettes and matching terrain profiles', () => {
    expect(PLANET_TYPE_CONFIGS.map((type) => type.publicName)).toEqual([
      'Nebula',
      'Desert',
      'Triplex',
      'Toxic',
      'Void',
      'Gaia',
      'Volcanic',
      'Gas Giant',
      'Rocky',
      'Oceanic',
    ]);
    expect(
      PLANET_TYPE_CONFIGS.every((type) =>
        type.visual.paletteVariants.every((variant) =>
          variant.coolorsUrl.startsWith('https://coolors.co/'),
        ),
      ),
    ).toBe(true);
    expect(
      PLANET_TYPE_CONFIGS.find((type) => type.id === 'volcanic')?.visual.terrainWeights[0]?.mode,
    ).toBe('turbulence');
    expect(
      PLANET_TYPE_CONFIGS.find((type) => type.id === 'gas-giant')?.visual.terrainWeights[0]?.mode,
    ).toBe('banded');
    expect(PLANET_TYPE_CONFIGS.find((type) => type.id === 'rocky')?.visual.terrainWeights[0]?.mode).toBe(
      'simplex',
    );
    expect(
      PLANET_TYPE_CONFIGS.find((type) => type.id === 'oceanic')?.visual.terrainWeights[0]?.mode,
    ).toBe('ocean-currents');
    expect(PLANET_TYPE_CONFIGS.find((type) => type.id === 'triplex')?.visual.terrainWeights).toEqual([
      { mode: 'gradation', weight: 1 },
    ]);
    expect(
      PLANET_TYPE_CONFIGS.filter((type) => type.id !== 'triplex')
        .flatMap((type) => type.visual.terrainWeights.map((terrain) => terrain.mode))
        .join(','),
    ).not.toContain('gradation');
    const volcanic = PLANET_TYPE_CONFIGS.find((type) => type.id === 'volcanic');
    expect(
      volcanic?.visual.paletteVariants.every((variant) =>
        variant.colors.every((color) => {
          const channels = [
            Number.parseInt(color.slice(1, 3), 16),
            Number.parseInt(color.slice(3, 5), 16),
            Number.parseInt(color.slice(5, 7), 16),
          ];
          return !(
            Math.min(...channels) > 190 && Math.max(...channels) - Math.min(...channels) < 45
          );
        }),
      ),
    ).toBe(true);
  });

  it('uses hierarchical rarity and mineral selection without a drawing ID cap', () => {
    const seen = new Set<string>();
    for (let index = 1; index <= 1_000; index += 1) {
      const descriptor = derivePlanet({ ...INPUT, ticketId: BigInt(index), drawingId: 1n }, CONFIG);
      seen.add(descriptor.traits.rarity);
      const range = PLANET_RARITY_CONFIG.find(
        (entry) => entry.rarity === descriptor.traits.rarity,
      );
      expect(range).toBeDefined();
      expect(descriptor.traits.minerals).toBeGreaterThanOrEqual(
        range?.min ?? Number.POSITIVE_INFINITY,
      );
      expect(descriptor.traits.minerals).toBeLessThanOrEqual(
        range?.max ?? Number.NEGATIVE_INFINITY,
      );
      expect(descriptor.traits.minerals).toBeGreaterThan(1);
    }
    expect(seen).toEqual(new Set(['Common', 'Uncommon', 'Epic', 'Legendary']));
  });

  it('derives names and all procedural traits without Math.random or special editions', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be used');
    });
    const first = derivePlanet(INPUT, CONFIG);
    const second = derivePlanet(INPUT, CONFIG);
    random.mockRestore();
    expect(second).toEqual(first);
    expect(first.traits.name).toMatch(/^[A-ZÀ-ÿ][A-Za-zÀ-ÿ]+(?:(?: [IVX]+)|(?:-\d{2}))?$/);
    expect(derivePlanetName(first.seed)).toBe(first.traits.name);
    expect(first.traits.specialEditionId).toBeNull();
  });

  it('keeps legacy scoring fields out of the render boundary', () => {
    const preview = derivePlanetPreview(INPUT, CONFIG);
    expect(preview.descriptor.seed).toBe(derivePlanetSeed(INPUT));
    expect(preview.visual.seed).toBe(preview.descriptor.seed);
    expect('dailyPoints' in preview.visual).toBe(false);
    expect('rarity' in preview.visual).toBe(false);
    expect('dailyPoints' in preview.visual.traits).toBe(false);
    expect('rarity' in preview.visual.traits).toBe(false);
    expect(preview.visualTraitsHash).toMatch(/^0x[\da-f]{64}$/);
  });

  it('rejects tampered serialized descriptors and re-derives trusted canonical data', () => {
    const descriptor = derivePlanet(INPUT, CONFIG);
    const serialized = serializePlanetDescriptor(descriptor);
    expect(deserializePlanetDescriptor(serialized, CONFIG)).toEqual(descriptor);
    expect(() =>
      deserializePlanetDescriptor(
        {
          ...serialized,
          traits: { ...serialized.traits, minerals: serialized.traits.minerals + 1 },
        },
        CONFIG,
      ),
    ).toThrow(/integrity/);
  });

  it('renders a deterministic 128px preview from the selected Type palette', () => {
    const visual = derivePlanetPreview(INPUT, CONFIG).visual;
    const first = renderPlanetFrame(visual, 0);
    const second = renderPlanetFrame(derivePlanetPreview(INPUT, CONFIG).visual, 0);
    expect([first.width, first.height]).toEqual([128, 128]);
    expect(second.data).toEqual(first.data);
    expect(() =>
      renderPlanetFrame(
        {
          ...visual,
          traits: {
            ...visual.traits,
            satellites: new Array(513).fill(visual.traits.satellites[0]),
          },
        },
        0,
      ),
    ).toThrow(/satellite count/);
  }, 10_000);

  it('selects all declared palette variants and preserves Type-only visual mechanics', () => {
    const configuredType = (id: string) => {
      const type = PLANET_TYPE_CONFIGS.find((candidate) => candidate.id === id);
      if (!type) throw new Error(`Missing configured Type: ${id}`);
      return type;
    };
    for (const type of PLANET_TYPE_CONFIGS) {
      const selected = new Set<string>();
      for (
        let ticketId = 1;
        ticketId <= 1_000 && selected.size < type.visual.paletteVariants.length;
        ticketId += 1
      ) {
        selected.add(
          deriveTypePalette(derivePlanetSeed({ ...INPUT, ticketId: BigInt(ticketId) }), type)
            .coolorsUrl,
        );
      }
      if (type.visual.paletteMode === 'variants') {
        expect(selected).toEqual(
          new Set(type.visual.paletteVariants.map((variant) => variant.coolorsUrl)),
        );
      }
    }

    const oceanic = derivePlanetPreviewForType(INPUT, CONFIG, 'oceanic');
    expect(oceanic.visual.traits.typePalette).toEqual(
      deriveTypePalette(oceanic.descriptor.seed, configuredType('oceanic')).colors,
    );
    expect(oceanic.visual.traits.colors.planet.some((color) => color === '#082f49')).toBe(false);

    const toxic = derivePlanetPreviewForType(INPUT, CONFIG, 'toxic');
    expect(toxic.visual.traits.hasClouds).toBe(false);
    expect(toxic.visual.traits.colors.planet).not.toEqual(oceanic.visual.traits.colors.planet);

    const gaia = derivePlanetPreviewForType(INPUT, CONFIG, 'gaia');
    expect(gaia.visual.traits.typePalette).toEqual(
      deriveTypePalette(gaia.descriptor.seed, configuredType('gaia')).colors,
    );
    expect(gaia.visual.traits.hasRing).toBe(false);

    const voidPlanet = derivePlanetPreviewForType(INPUT, CONFIG, 'void');
    expect(voidPlanet.visual.traits.paletteType).toBe('cavity');
    expect(voidPlanet.visual.traits.colors.planet).toEqual([null, expect.any(String), null]);
    const cavity = deriveOriginalCavityColors(voidPlanet.descriptor.seed);
    expect(voidPlanet.visual.traits.colors).toMatchObject({
      background: cavity.background,
      planet: [null, cavity.core, null],
      cloud: cavity.cloud,
      satellite: cavity.satellite,
      star: cavity.star,
    });
  });

  it('uses every configured terrain in canonical and Lab Type previews', () => {
    for (const type of PLANET_TYPE_CONFIGS) {
      const expected = new Set(type.visual.terrainWeights.map((entry) => entry.mode));
      const canonical = new Set<string>();
      const lab = new Set<string>();
      for (
        let ticketId = 1;
        ticketId <= 10_000 && (canonical.size < expected.size || lab.size < expected.size);
        ticketId += 1
      ) {
        const input = { ...INPUT, ticketId: BigInt(ticketId) };
        canonical.add(deriveTypeTerrain(derivePlanetSeed(input), type));
        lab.add(
          derivePlanetPreviewForType(input, CONFIG, type.id as typeof type.id).visual.traits
            .noiseMode,
        );
      }
      expect(canonical).toEqual(expected);
      expect(lab).toEqual(expected);
    }
  });

  it('keeps volcanic ash gray and prevents forbidden rings', () => {
    for (const typeId of ['gaia', 'rocky', 'volcanic'] as const) {
      const type = PLANET_TYPE_CONFIGS.find((candidate) => candidate.id === typeId);
      if (!type) throw new Error(`Missing configured Type: ${typeId}`);
      for (let ticketId = 1; ticketId <= 1_000; ticketId += 1) {
        expect(
          deriveTypeSatellites(derivePlanetSeed({ ...INPUT, ticketId: BigInt(ticketId) }), type)
            .hasRing,
        ).toBe(false);
      }
    }
    const volcanic = Array.from({ length: 40 }, (_, index) =>
      derivePlanetPreviewForType({ ...INPUT, ticketId: BigInt(index + 1) }, CONFIG, 'volcanic'),
    ).find((preview) => preview.visual.traits.hasClouds);
    expect(volcanic).toBeDefined();
    expect(volcanic?.visual.traits.colors.cloud).toEqual(['#9a9d9c', '#45484d']);
  });

  it('samples every original and Planet terrain mode deterministically', () => {
    const modes = [
      'simplex',
      'ridged',
      'domain-warping',
      'vertical-stripes',
      'horizontal-stripes',
      'gradation',
      'turbulence',
      'banded',
      'cratered',
      'ocean-currents',
      'cellular',
      'polar-caps',
      'pixel-continents',
      'archipelago',
      'pixel-mountain-ridges',
      'spiral-currents',
    ] as const;
    const first = createTerrainNoiseSampler(derivePlanetSeed(INPUT));
    const second = createTerrainNoiseSampler(derivePlanetSeed(INPUT));
    for (const mode of modes) {
      const sample = first(mode, 12, 17, 64);
      expect(sample.value).toBeGreaterThanOrEqual(0);
      expect(sample.value).toBeLessThanOrEqual(1);
      expect(sample.defaultWeights.length).toBeGreaterThan(0);
      expect(second(mode, 12, 17, 64)).toEqual(sample);
    }
  });
});

describe('generator public metadata', () => {
  it('uses the required public attribute order and keeps technical provenance out of attributes', () => {
    const descriptor = derivePlanet(INPUT, CONFIG);
    const metadata = buildPlanetMetadata(descriptor, CONFIG);
    expect(metadata.description).toBe(
      `MegaPlanet ${descriptor.traits.name}, deterministically generated from Megapot ticket #456.`,
    );
    expect(metadata.attributes.map((attribute) => attribute.trait_type)).toEqual([
      'Name',
      'Type',
      'Satellites',
      'Minerals',
      'Rarity',
      'Seed',
    ]);
    expect(
      metadata.attributes.some(
        (attribute) => attribute.trait_type === ('generatorVersion' as never),
      ),
    ).toBe(false);
    expect(metadata.attributes.find((attribute) => attribute.trait_type === 'Satellites')).toEqual({
      trait_type: 'Satellites',
      value: descriptor.traits.satelliteCount,
    });
    expect(
      metadata.attributes.some((attribute) => attribute.trait_type === ('Terrain' as never)),
    ).toBe(false);
    expect(metadata.provenance).toMatchObject({
      ticketId: '456',
      drawingId: '123',
      originTxHash: ORIGIN_A,
      specialEditionId: null,
      traitsHash: descriptor.traitsHash,
    });
    expect('generatorVersion' in metadata.provenance).toBe(false);
  });
});

describe('canonical trait and GIF consistency', () => {
  it.each(GOLDEN_VECTORS)('keeps $name metadata and render traits aligned', ({ input }) => {
    const preview = derivePlanetPreview(input, CONFIG);
    const metadata = buildPlanetMetadata(preview.descriptor, CONFIG);
    expect(
      metadata.attributes.find((attribute) => attribute.trait_type === 'Satellites')?.value,
    ).toBe(preview.descriptor.traits.satelliteCount);
    expect(preview.visual.traits.satellites).toHaveLength(preview.descriptor.traits.satelliteCount);
    expect(preview.visual.traits.hasRing).toBe(preview.descriptor.traits.hasRing);
    expect(preview.visual.traits.planetType).toBe(preview.descriptor.traits.typeId);
    expect(preview.visual.traits.typePalette).toEqual(preview.descriptor.traits.palette.colors);
    expect(preview.visual.traits.noiseMode).toBe(preview.descriptor.traits.terrain);
  });

  it('covers every configured Type through canonical deterministic selection', () => {
    const seen = new Map<string, ReturnType<typeof derivePlanetPreview>>();
    for (let ticketId = 1; ticketId <= 10_000 && seen.size < PLANET_TYPE_CONFIGS.length; ticketId += 1) {
      const preview = derivePlanetPreview({ ...INPUT, ticketId: BigInt(ticketId) }, CONFIG);
      seen.set(preview.descriptor.traits.typeId, preview);
    }
    expect([...seen.keys()].sort()).toEqual(PLANET_TYPE_CONFIGS.map((type) => type.id).sort());
    for (const preview of seen.values()) {
      expect(preview.visual.traits.planetType).toBe(preview.descriptor.traits.typeId);
      expect(preview.visual.traits.typePalette).toEqual(preview.descriptor.traits.palette.colors);
      expect(preview.visual.traits.noiseMode).toBe(preview.descriptor.traits.terrain);
      expect(preview.visual.traits.satellites).toHaveLength(
        preview.descriptor.traits.satelliteCount,
      );
    }
  });

  it('represents a ring with its exact rendered particle count', () => {
    let ringInput: typeof INPUT | undefined;
    let ringDescriptor: ReturnType<typeof derivePlanet> | undefined;
    for (let ticketId = 1; ticketId <= 10_000; ticketId += 1) {
      const input = { ...INPUT, ticketId: BigInt(ticketId) } as typeof INPUT;
      const descriptor = derivePlanet(input, CONFIG);
      if (descriptor.traits.hasRing) {
        ringInput = input;
        ringDescriptor = descriptor;
        break;
      }
    }
    expect(ringInput).toBeDefined();
    expect(ringDescriptor).toBeDefined();
    if (!(ringInput && ringDescriptor)) return;

    const preview = derivePlanetPreview(ringInput, CONFIG);
    const metadata = buildPlanetMetadata(ringDescriptor, CONFIG);
    expect(
      metadata.attributes.find((attribute) => attribute.trait_type === 'Satellites')?.value,
    ).toBe(ringDescriptor.traits.satelliteCount);
    expect(preview.visual.traits.satellites).toHaveLength(ringDescriptor.traits.satelliteCount);
    expect(preview.visual.traits.hasRing).toBe(true);
    expect(preview.visual.traits.satellites.every((satellite) => satellite.rotation === 0)).toBe(
      true,
    );
  });
});

describe('generator GIF fixtures', () => {
  const fixtureDirectory = fileURLToPath(new URL('./fixtures/', import.meta.url));
  const manifest = JSON.parse(readFileSync(`${fixtureDirectory}manifest.json`, 'utf8')) as Array<
    Record<string, unknown>
  >;
  const config = createPlanetConfig();

  it.each(GOLDEN_VECTORS)('reproduces $name byte-for-byte', ({ name, input }) => {
    const preview = derivePlanetPreview(input, config);
    const firstFrame = renderPlanetFrame(preview.visual, 0);
    const middleFrame = renderPlanetFrame(preview.visual, GENERATOR_CONFIG.durationMs / 2);
    const gif = renderPlanetGif(preview.visual);
    const actual = {
      name,
      input: serializePlanetInput(input),
      seed: preview.descriptor.seed,
      canonicalTraitsJson: preview.descriptor.canonicalTraitsJson,
      traitsHash: preview.descriptor.traitsHash,
      canonicalVisualTraitsJson: preview.canonicalVisualTraitsJson,
      visualTraitsHash: preview.visualTraitsHash,
      firstFrameSha256: sha256(toHex(new Uint8Array(firstFrame.data.buffer))),
      middleFrameSha256: sha256(toHex(new Uint8Array(middleFrame.data.buffer))),
      gifSha256: sha256(toHex(gif)),
      gifBytes: gif.length,
    };
    expect(actual).toEqual(manifest.find((entry) => entry.name === name));
    expect(gif).toEqual(new Uint8Array(readFileSync(`${fixtureDirectory}${name}.gif`)));
    expect(inspectGif(gif)).toEqual({
      width: 128,
      height: 128,
      frames: 144,
      durationMs: 12_000,
      repeat: 0,
    });
  });

  it('changes canonical seed and artwork when only drawingId changes', () => {
    const input = GOLDEN_VECTORS[0]?.input;
    if (!input) throw new Error('Missing golden vector.');
    const first = derivePlanetPreview(input, config);
    const second = derivePlanetPreview({ ...input, drawingId: input.drawingId + 1n }, config);
    expect(second.descriptor.seed).not.toBe(first.descriptor.seed);
    expect(second.visualTraitsHash).not.toBe(first.visualTraitsHash);
    expect(renderPlanetGif(second.visual)).not.toEqual(renderPlanetGif(first.visual));
  });
});
