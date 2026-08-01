import { createNoise3D, type NoiseFunction3D } from 'simplex-noise';
import { GENERATOR_CONFIG_V1 } from './config';
import { namedRandom } from './random';
import type { HexColor, NoiseMode, PlanetDescriptor, PlanetFrame, SatelliteTrait } from './types';

type Rgb = readonly [number, number, number];
type Surface = {
  diameter: number;
  palette: readonly (HexColor | null)[];
  backColor: HexColor | null;
  lapMs: number;
  gridWidth: number;
  grid: Uint8Array;
  sphereWidths: readonly number[];
};
type Star = { x: number; y: number; color: HexColor };
type Scene = { descriptor: PlanetDescriptor; surfaces: readonly Surface[]; stars: readonly Star[] };

const TAU = Math.PI * 2;

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

export function hexColorToRgb(color: HexColor): Rgb {
  const value = Number.parseInt(color.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function setPixel(buffer: Uint8ClampedArray, x: number, y: number, color: HexColor | null) {
  if (color === null) return;
  const size = GENERATOR_CONFIG_V1.logicalSize;
  const px = Math.floor(x);
  const py = Math.floor(y);
  if (px < 0 || px >= size || py < 0 || py >= size) return;
  const offset = (py * size + px) * 4;
  const [red, green, blue] = hexColorToRgb(color);
  buffer[offset] = red;
  buffer[offset + 1] = green;
  buffer[offset + 2] = blue;
  buffer[offset + 3] = 255;
}

function sphereWidths(diameter: number): readonly number[] {
  const widths = new Array<number>(diameter).fill(0);
  const parity = 1 - (diameter % 2);
  let radius = Math.floor(diameter / 2) - parity;
  let y = -radius;
  let x = 0;
  let decision = 2 - 2 * radius;
  const initialRadius = radius;
  do {
    radius = decision;
    if (radius > y || decision > x) {
      const width = x * 2 + 1 + parity;
      widths[y + initialRadius] = width;
      widths[diameter - y - initialRadius - 1] = width;
      y += 1;
      decision += y * 2 + 1;
    }
    if (radius <= x) {
      x += 1;
      decision += x * 2 + 1;
    }
  } while (y <= 0);
  return widths;
}

function fbm(
  noise: NoiseFunction3D,
  x: number,
  y: number,
  z: number,
  transform: (value: number) => number,
): number {
  let value = 0;
  let denominator = 0;
  for (let octave = 0; octave < 6; octave += 1) {
    const amplitude = 0.5 ** octave;
    const scale = 2 ** octave;
    value += amplitude * transform(noise(x * scale, y * scale, z * scale));
    denominator += amplitude;
  }
  return value / denominator;
}

function sampleNoise(
  mode: NoiseMode,
  noise: NoiseFunction3D,
  x: number,
  y: number,
  diameter: number,
): { value: number; weights: readonly number[] } {
  const gridWidth = diameter * 2;
  const phi = (x / gridWidth) * TAU;
  const theta = (y / diameter) * Math.PI;
  const nx = Math.sin(theta) * Math.cos(phi) + 1;
  const ny = Math.sin(theta) * Math.sin(phi) + 1;
  const nz = Math.cos(theta) + 1;
  const simplex = () => fbm(noise, nx, ny, nz, (raw) => raw * 0.5 + 0.5);

  switch (mode) {
    case 'simplex':
      return { value: simplex(), weights: [8, 6, 11] };
    case 'ridged':
      return { value: 1 - fbm(noise, nx, ny, nz, (raw) => Math.abs(raw)), weights: [2, 1, 1] };
    case 'domain-warping': {
      const warp = noise(nx, ny, nz) * 0.5 + 0.5;
      return {
        value: fbm(noise, nx + warp, ny + warp, nz + warp, (raw) => raw * 0.5 + 0.5),
        weights: [8, 6, 11],
      };
    }
    case 'vertical-stripes': {
      const offset = simplex();
      return {
        value: (Math.cos(((4 * x) / gridWidth + offset) * (diameter / 32) * TAU) + 1) / 2,
        weights: [2, 3, 2],
      };
    }
    case 'horizontal-stripes': {
      const offset = simplex();
      return {
        value: (Math.cos(((4 * y) / diameter + offset) * (diameter / 32) * TAU) + 1) / 2,
        weights: [1, 2, 1],
      };
    }
    case 'gradation': {
      const offset = simplex();
      return { value: (y + offset * 20) / (diameter + 20), weights: [2, 1, 2] };
    }
  }
}

function weightedIndex(weights: readonly number[], value: number): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let target = Math.max(0, Math.min(0.999999999999, value)) * total;
  for (let index = 0; index < weights.length; index += 1) {
    const weight = weights[index] ?? 0;
    if (target < weight) return index;
    target -= weight;
  }
  return weights.length - 1;
}

function createSurface(
  descriptor: PlanetDescriptor,
  namespace: string,
  diameter: number,
  mode: NoiseMode,
  palette: readonly (HexColor | null)[],
  lapMs: number,
  backColor: HexColor | null,
): Surface {
  const rng = namedRandom(descriptor.seed, `surface:${namespace}`);
  const noise = createNoise3D(() => rng.next());
  const gridWidth = diameter * 2;
  const grid = new Uint8Array(gridWidth * diameter);
  const gradationWeights = [rng.float(1, 4), rng.float(1, 4), rng.float(1, 4)];

  for (let x = 0; x < gridWidth; x += 1) {
    for (let y = 0; y < diameter; y += 1) {
      const sample = sampleNoise(mode, noise, x, y, diameter);
      const weights = mode === 'gradation' ? gradationWeights : sample.weights;
      grid[y * gridWidth + x] = weightedIndex(weights.slice(0, palette.length), sample.value);
    }
  }
  return {
    diameter,
    palette,
    backColor,
    lapMs,
    gridWidth,
    grid,
    sphereWidths: sphereWidths(diameter),
  };
}

function createStars(descriptor: PlanetDescriptor): readonly Star[] {
  const rng = namedRandom(descriptor.seed, 'star-field');
  const size = GENERATOR_CONFIG_V1.logicalSize;
  const stars: Star[] = [];
  const minimumDistanceSquared = 14 * 14;
  let attempts = 0;
  while (
    stars.length < descriptor.traits.starCount &&
    attempts < descriptor.traits.starCount * 100
  ) {
    attempts += 1;
    const x = rng.int(1, size - 1);
    const y = rng.int(1, size - 1);
    if (stars.some((star) => (star.x - x) ** 2 + (star.y - y) ** 2 < minimumDistanceSquared)) {
      continue;
    }
    stars.push({
      x,
      y,
      color: descriptor.traits.colors.star[rng.weightedIndex([3, 6])],
    });
  }
  return stars;
}

export function createPlanetScene(descriptor: PlanetDescriptor): Scene {
  const traits = descriptor.traits;
  const main = createSurface(
    descriptor,
    'main',
    traits.diameter,
    traits.noiseMode,
    traits.colors.planet,
    traits.mainLapMs,
    traits.paletteType === 'cavity' ? traits.colors.cloud[0] : null,
  );
  const cloud =
    traits.hasClouds && traits.cloudNoiseMode && traits.cloudLapMs
      ? createSurface(
          descriptor,
          'cloud',
          traits.diameter + 4,
          traits.cloudNoiseMode,
          [traits.colors.cloud[0], null, traits.colors.cloud[0]],
          traits.cloudLapMs,
          traits.colors.cloud[1],
        )
      : null;
  return { descriptor, surfaces: cloud ? [main, cloud] : [main], stars: createStars(descriptor) };
}

function loopCycles(loopDurationMs: number, periodMs: number): number {
  return Math.max(1, Math.round(loopDurationMs / periodMs));
}

export function isSatelliteBehind(angleRadians: number): boolean {
  return mod(angleRadians, Math.PI * 2) > Math.PI;
}

function drawSurface(
  buffer: Uint8ClampedArray,
  surface: Surface,
  timeMs: number,
  back: boolean,
  loopDurationMs?: number,
) {
  if (back && surface.backColor === null) return;
  const center = GENERATOR_CONFIG_V1.logicalSize / 2;
  const frameOffset = loopDurationMs
    ? (mod(timeMs, loopDurationMs) / loopDurationMs) *
      loopCycles(loopDurationMs, surface.lapMs) *
      surface.gridWidth
    : (timeMs / surface.lapMs) * surface.gridWidth;
  for (let y = 0; y < surface.diameter; y += 1) {
    const width = surface.sphereWidths[y] ?? 0;
    for (let x = 0; x < width; x += 1) {
      const gridX = Math.floor((x / width + (back ? 1 : 0)) * surface.diameter - frameOffset);
      const colorIndex = surface.grid[y * surface.gridWidth + mod(gridX, surface.gridWidth)];
      const color = back ? surface.backColor : (surface.palette[colorIndex] ?? null);
      const pixelX = (back ? -1 : 1) * (x - width / 2 + 0.5) + center;
      const pixelY = y + center - surface.diameter / 2;
      setPixel(buffer, pixelX, pixelY, color);
    }
  }
}

function drawSatellite(
  buffer: Uint8ClampedArray,
  satellite: SatelliteTrait,
  timeMs: number,
  back: boolean,
  loopDurationMs?: number,
) {
  const motionDegrees = loopDurationMs
    ? -(mod(timeMs, loopDurationMs) / loopDurationMs) *
      360 *
      loopCycles(loopDurationMs, 6_000 / satellite.speed)
    : -(timeMs / 1000) * 60 * satellite.speed;
  const radians =
    mod(motionDegrees - satellite.initialAngle * satellite.speed, 360) * (Math.PI / 180);
  // The source generator swaps layers as the orbit crosses its horizontal axis.
  // With our positive angle normalization, the upper half (PI..2PI) is behind.
  if (back !== isSatelliteBehind(radians)) return;
  const rotation = satellite.rotation * (Math.PI / 180);
  const ellipseX = satellite.orbitX * Math.cos(radians);
  const ellipseY = satellite.orbitY * Math.sin(radians);
  const center = GENERATOR_CONFIG_V1.logicalSize / 2;
  const offsetX = ellipseX * Math.cos(rotation) - ellipseY * Math.sin(rotation);
  const offsetY = ellipseX * Math.sin(rotation) + ellipseY * Math.cos(rotation);
  const widths = sphereWidths(satellite.diameter);
  for (let y = 0; y < satellite.diameter; y += 1) {
    const width = widths[y] ?? 0;
    for (let x = 0; x < width; x += 1) {
      setPixel(
        buffer,
        center + offsetX + x - width / 2 + 0.5,
        center + offsetY + y - satellite.diameter / 2,
        satellite.color,
      );
    }
  }
}

function upscale(logical: Uint8ClampedArray): Uint8ClampedArray<ArrayBuffer> {
  const logicalSize = GENERATOR_CONFIG_V1.logicalSize;
  const outputSize = GENERATOR_CONFIG_V1.outputSize;
  const scale = GENERATOR_CONFIG_V1.scale;
  const output = new Uint8ClampedArray(outputSize * outputSize * 4);
  for (let y = 0; y < outputSize; y += 1) {
    for (let x = 0; x < outputSize; x += 1) {
      const source = (Math.floor(y / scale) * logicalSize + Math.floor(x / scale)) * 4;
      const target = (y * outputSize + x) * 4;
      output[target] = logical[source];
      output[target + 1] = logical[source + 1];
      output[target + 2] = logical[source + 2];
      output[target + 3] = logical[source + 3];
    }
  }
  return output;
}

export function renderPlanetSceneFrame(
  scene: Scene,
  timeMs: number,
  loopDurationMs?: number,
): PlanetFrame {
  const size = GENERATOR_CONFIG_V1.logicalSize;
  const logical = new Uint8ClampedArray(size * size * 4);
  const [red, green, blue] = hexColorToRgb(scene.descriptor.traits.colors.background);
  for (let offset = 0; offset < logical.length; offset += 4) {
    logical[offset] = red;
    logical[offset + 1] = green;
    logical[offset + 2] = blue;
    logical[offset + 3] = 255;
  }
  for (const star of scene.stars) setPixel(logical, star.x, star.y, star.color);
  for (let index = scene.descriptor.traits.satellites.length - 1; index >= 0; index -= 1) {
    const satellite = scene.descriptor.traits.satellites[index];
    if (satellite) drawSatellite(logical, satellite, timeMs, true, loopDurationMs);
  }
  for (let index = scene.surfaces.length - 1; index >= 0; index -= 1) {
    const surface = scene.surfaces[index];
    if (surface) drawSurface(logical, surface, timeMs, true, loopDurationMs);
  }
  for (const surface of scene.surfaces) {
    drawSurface(logical, surface, timeMs, false, loopDurationMs);
  }
  for (const satellite of scene.descriptor.traits.satellites) {
    drawSatellite(logical, satellite, timeMs, false, loopDurationMs);
  }
  return {
    width: GENERATOR_CONFIG_V1.outputSize,
    height: GENERATOR_CONFIG_V1.outputSize,
    data: upscale(logical),
  };
}

export function renderPlanetFrame(descriptor: PlanetDescriptor, timeMs: number): PlanetFrame {
  if (!Number.isFinite(timeMs) || timeMs < 0) throw new RangeError('timeMs must be non-negative.');
  return renderPlanetSceneFrame(createPlanetScene(descriptor), timeMs);
}
