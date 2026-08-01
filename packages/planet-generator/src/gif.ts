import * as gifencModule from 'gifenc';
import { GENERATOR_CONFIG_V1 } from './config';
import { createPlanetScene, hexColorToRgb, renderPlanetSceneFrame } from './render';
import type { HexColor, PlanetDescriptor } from './types';

type GifPalette = readonly (readonly [number, number, number])[];
type GifencApi = Pick<typeof gifencModule, 'GIFEncoder' | 'applyPalette'>;

const defaultExport = gifencModule.default as unknown;
const fallbackApi =
  typeof defaultExport === 'object' && defaultExport !== null
    ? (defaultExport as GifencApi)
    : undefined;
const GIFEncoder = gifencModule.GIFEncoder ?? fallbackApi?.GIFEncoder;
const applyPalette = gifencModule.applyPalette ?? fallbackApi?.applyPalette;
if (!GIFEncoder || !applyPalette) {
  throw new Error('gifenc did not expose the required encoder API.');
}

function descriptorPalette(descriptor: PlanetDescriptor): GifPalette {
  const colors = new Set<HexColor>();
  colors.add(descriptor.traits.colors.background);
  for (const color of descriptor.traits.colors.planet) if (color) colors.add(color);
  for (const color of descriptor.traits.colors.cloud) colors.add(color);
  for (const color of descriptor.traits.colors.satellite) colors.add(color);
  for (const color of descriptor.traits.colors.star) colors.add(color);
  for (const satellite of descriptor.traits.satellites) colors.add(satellite.color);
  return [...colors].map(hexColorToRgb);
}

export function renderPlanetGif(descriptor: PlanetDescriptor): Uint8Array {
  const scene = createPlanetScene(descriptor);
  const palette = descriptorPalette(descriptor);
  const gif = GIFEncoder({ initialCapacity: 512 * 1024 });
  const frameDuration = GENERATOR_CONFIG_V1.durationMs / GENERATOR_CONFIG_V1.frameCount;

  for (let frameIndex = 0; frameIndex < GENERATOR_CONFIG_V1.frameCount; frameIndex += 1) {
    const frame = renderPlanetSceneFrame(
      scene,
      frameIndex * frameDuration,
      GENERATOR_CONFIG_V1.durationMs,
    );
    gif.writeFrame(applyPalette(frame.data, palette), frame.width, frame.height, {
      palette: frameIndex === 0 ? palette : undefined,
      delay: frameIndex % 3 === 2 ? 90 : 80,
      repeat: 0,
    });
  }
  gif.finish();
  return gif.bytes();
}
