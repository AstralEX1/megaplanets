import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { sha256, toHex } from 'viem';
import {
  GENERATOR_CONFIG_V1,
  derivePlanet,
  renderPlanetFrame,
  renderPlanetGif,
  serializePlanetInput,
} from '../src';
import { GOLDEN_VECTORS } from '../tests/vectors';

const fixturesDirectory = fileURLToPath(new URL('../tests/fixtures/', import.meta.url));
await mkdir(fixturesDirectory, { recursive: true });

const manifest = [];
for (const vector of GOLDEN_VECTORS) {
  const descriptor = derivePlanet(vector.input);
  const firstFrame = renderPlanetFrame(descriptor, 0);
  const middleFrame = renderPlanetFrame(descriptor, GENERATOR_CONFIG_V1.durationMs / 2);
  const gif = renderPlanetGif(descriptor);
  await writeFile(`${fixturesDirectory}${vector.name}.gif`, gif);
  manifest.push({
    name: vector.name,
    input: serializePlanetInput(vector.input),
    seed: descriptor.seed,
    dailyPoints: descriptor.dailyPoints.toString(),
    rarity: descriptor.rarity,
    canonicalTraitsJson: descriptor.canonicalTraitsJson,
    traitsHash: descriptor.traitsHash,
    firstFrameSha256: sha256(toHex(new Uint8Array(firstFrame.data.buffer))),
    middleFrameSha256: sha256(toHex(new Uint8Array(middleFrame.data.buffer))),
    gifSha256: sha256(toHex(gif)),
    gifBytes: gif.length,
  });
}

await writeFile(`${fixturesDirectory}manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
