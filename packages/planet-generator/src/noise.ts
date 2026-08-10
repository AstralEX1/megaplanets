import { createNoise3D, type NoiseFunction3D } from 'simplex-noise';
import { namedRandom } from './generator-random';
import type { TerrainMode } from './types';
import type { Hex } from './visual-types';

const TAU = Math.PI * 2;

export type TerrainNoiseSample = {
  value: number;
  defaultWeights: readonly number[];
};

export type TerrainNoiseSampler = (
  mode: TerrainMode,
  x: number,
  y: number,
  diameter: number,
) => TerrainNoiseSample;

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function quantize(value: number, levels: number): number {
  return Math.round(clamp(value) * levels) / levels;
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

/**
 * A pure, seed-owned terrain sampler. New modes are -only so they cannot change
 * the accepted pixel renderer or its fixtures.
 */
export function createTerrainNoiseSampler(
  seed: Hex,
  namespace = 'terrain-noise',
): TerrainNoiseSampler {
  const rng = namedRandom(seed, namespace);
  const noise = createNoise3D(() => rng.next());

  return (mode, x, y, diameter) => {
    if (
      !Number.isSafeInteger(x) ||
      !Number.isSafeInteger(y) ||
      !Number.isSafeInteger(diameter) ||
      diameter <= 0 ||
      diameter > 4_096 ||
      x < 0 ||
      x > diameter * 2 ||
      y < 0 ||
      y > diameter
    ) {
      throw new RangeError('Terrain coordinates must be inside a valid diameter up to 4096.');
    }
    const gridWidth = diameter * 2;
    const phi = (x / gridWidth) * TAU;
    const theta = (y / diameter) * Math.PI;
    const nx = Math.sin(theta) * Math.cos(phi) + 1;
    const ny = Math.sin(theta) * Math.sin(phi) + 1;
    const nz = Math.cos(theta) + 1;
    const simplex = () => fbm(noise, nx, ny, nz, (raw) => raw * 0.5 + 0.5);
    const cellular = () => {
      const warpedX = nx * 3 + noise(nx, ny, nz) * 0.5;
      const warpedY = ny * 3 + noise(ny, nz, nx) * 0.5;
      const nearestX = Math.round(warpedX);
      const nearestY = Math.round(warpedY);
      return clamp(Math.hypot(warpedX - nearestX, warpedY - nearestY) * 1.4);
    };

    switch (mode) {
      case 'simplex':
        return { value: simplex(), defaultWeights: [8, 6, 11] };
      case 'ridged':
        return {
          value: 1 - fbm(noise, nx, ny, nz, (raw) => Math.abs(raw)),
          defaultWeights: [2, 1, 1],
        };
      case 'domain-warping': {
        const warp = noise(nx, ny, nz) * 0.5 + 0.5;
        return {
          value: fbm(noise, nx + warp, ny + warp, nz + warp, (raw) => raw * 0.5 + 0.5),
          defaultWeights: [8, 6, 11],
        };
      }
      case 'vertical-stripes':
        return {
          value: (Math.cos(((4 * x) / gridWidth + simplex()) * (diameter / 32) * TAU) + 1) / 2,
          defaultWeights: [2, 3, 2],
        };
      case 'horizontal-stripes':
        return {
          value: (Math.cos(((4 * y) / diameter + simplex()) * (diameter / 32) * TAU) + 1) / 2,
          defaultWeights: [1, 2, 1],
        };
      case 'gradation':
        return { value: clamp((y + simplex() * 20) / (diameter + 20)), defaultWeights: [2, 1, 2] };
      case 'turbulence': {
        const warpX = nx + (noise(ny, nz, nx) * 0.5 + 0.5) * 1.5;
        const warpY = ny + (noise(nz, nx, ny) * 0.5 + 0.5) * 1.5;
        return {
          value: fbm(noise, warpX, warpY, nz, (raw) => Math.abs(raw)),
          defaultWeights: [2, 3, 5],
        };
      }
      case 'banded': {
        const offset = simplex() * 0.35;
        return {
          value: (Math.sin((y / diameter + offset) * TAU * 7) + 1) / 2,
          defaultWeights: [3, 5, 3],
        };
      }
      case 'cratered': {
        const crater = 1 - cellular();
        return {
          value: clamp(crater * 0.72 + simplex() * 0.28),
          defaultWeights: [5, 3, 2],
        };
      }
      case 'ocean-currents': {
        const current = Math.sin((phi + simplex() * 2.5) * 3 + Math.sin(theta * 4));
      return { value: clamp(current * 0.35 + simplex() * 0.65), defaultWeights: [4, 3, 4] };
      }
      case 'cellular':
        return { value: cellular(), defaultWeights: [3, 4, 2] };
      case 'polar-caps': {
        const latitude = Math.abs(Math.cos(theta));
        return {
          value: clamp(latitude * 0.75 + simplex() * 0.25),
          defaultWeights: [2, 3, 4],
        };
      }
      case 'pixel-continents':
        return { value: quantize(simplex(), 4), defaultWeights: [3, 3, 4] };
      case 'archipelago':
        return {
          value: quantize(clamp((1 - cellular()) * 0.65 + simplex() * 0.35), 4),
          defaultWeights: [3, 3, 5],
        };
      case 'pixel-mountain-ridges':
        return {
          value: quantize(1 - fbm(noise, nx, ny, nz, (raw) => Math.abs(raw)), 5),
          defaultWeights: [5, 4, 1],
        };
      case 'spiral-currents': {
        const curl =
          Math.sin(phi * 3 + theta * 5 + simplex() * 1.8 + Math.sin(theta * 3) * 2) * 0.5 + 0.5;
        return {
          value: quantize(clamp(curl * 0.72 + simplex() * 0.28), 5),
          defaultWeights: [3, 4, 3],
        };
      }
      default:
        throw new RangeError('Unsupported terrain mode.');
    }
  };
}
