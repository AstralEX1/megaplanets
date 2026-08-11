import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { sha256, toHex } from 'viem';
import {
  createPlanetConfig,
  derivePlanetPreview,
  GENERATOR_CONFIG,
  renderPlanetFrame,
  renderPlanetGif,
  serializePlanetInput,
} from '../src';
import { GOLDEN_VECTORS } from '../tests/golden-vectors';

const fixtureDirectory = fileURLToPath(new URL('../tests/fixtures/', import.meta.url));
await mkdir(fixtureDirectory, { recursive: true });
const config = createPlanetConfig();
const manifest = [];

for (const vector of GOLDEN_VECTORS) {
  const preview = derivePlanetPreview(vector.input, config);
  const firstFrame = renderPlanetFrame(preview.visual, 0);
  const middleFrame = renderPlanetFrame(preview.visual, GENERATOR_CONFIG.durationMs / 2);
  const gif = renderPlanetGif(preview.visual);
  await writeFile(`${fixtureDirectory}${vector.name}.gif`, gif);
  manifest.push({
    name: vector.name,
    input: serializePlanetInput(vector.input),
    seed: preview.descriptor.seed,
    canonicalTraitsJson: preview.descriptor.canonicalTraitsJson,
    traitsHash: preview.descriptor.traitsHash,
    canonicalVisualTraitsJson: preview.canonicalVisualTraitsJson,
    visualTraitsHash: preview.visualTraitsHash,
    firstFrameSha256: sha256(toHex(new Uint8Array(firstFrame.data.buffer))),
    middleFrameSha256: sha256(toHex(new Uint8Array(middleFrame.data.buffer))),
    gifSha256: sha256(toHex(gif)),
    gifBytes: gif.length,
  });
}

await writeFile(`${fixtureDirectory}manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
