import * as gifencModule from 'gifenc';
import { createPlanetScene, hexColorToRgb, renderPlanetSceneFrame } from './render';
import { GENERATOR_CONFIG } from './render-config';
import type { HexColor, PlanetRenderDescriptor } from './visual-types';

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

function descriptorPalette(descriptor: PlanetRenderDescriptor): GifPalette {
  const colors = new Set<HexColor>();
  colors.add(descriptor.traits.colors.background);
  for (const color of descriptor.traits.colors.planet) if (color) colors.add(color);
  for (const color of descriptor.traits.colors.cloud) colors.add(color);
  for (const color of descriptor.traits.colors.satellite) colors.add(color);
  for (const color of descriptor.traits.colors.star) colors.add(color);
  for (const satellite of descriptor.traits.satellites) colors.add(satellite.color);
  return [...colors].map(hexColorToRgb);
}

export function renderPlanetGif(descriptor: PlanetRenderDescriptor): Uint8Array {
  const scene = createPlanetScene(descriptor);
  const palette = descriptorPalette(descriptor);
  const gif = GIFEncoder({ initialCapacity: 512 * 1024 });
  const frameDuration = GENERATOR_CONFIG.durationMs / GENERATOR_CONFIG.frameCount;

  for (let frameIndex = 0; frameIndex < GENERATOR_CONFIG.frameCount; frameIndex += 1) {
    const frame = renderPlanetSceneFrame(
      scene,
      frameIndex * frameDuration,
      GENERATOR_CONFIG.durationMs,
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
