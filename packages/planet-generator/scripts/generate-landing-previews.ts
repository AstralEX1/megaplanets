import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { sha256, toHex } from 'viem';
import {
  createPlanetConfig,
  derivePlanetPreview,
  renderPlanetGif,
  serializePlanetInput,
} from '../src';

const outputDirectory = fileURLToPath(new URL('../../../artifacts/megastera-generated/', import.meta.url));
const originTxHash = `0x${'51'.repeat(32)}` as `0x${string}`;
const previewCount = 16;
const config = createPlanetConfig();
const manifest = [];

await mkdir(outputDirectory, { recursive: true });

for (let index = 0; index < previewCount; index += 1) {
  const ticketId = 5001n + BigInt(index);
  const ticketNumber = Number(ticketId);
  const normalStart = (ticketNumber * 13) % 255;
  const input = {
    ticketId,
    drawingId: BigInt(700 + (ticketNumber % 5)),
    normals: Array.from({ length: 5 }, (_, normalIndex) => ((normalStart + normalIndex * 31) % 255) + 1),
    bonusBall: ((ticketNumber * 17) % 255) + 1,
    originTxHash,
  } as const;
  const preview = derivePlanetPreview(input, config);
  const gif = renderPlanetGif(preview.visual);
  const file = `planet-${String(index + 1).padStart(2, '0')}.gif`;

  await writeFile(`${outputDirectory}${file}`, gif);
  manifest.push({
    file,
    input: serializePlanetInput(input),
    name: preview.descriptor.traits.name,
    type: preview.descriptor.traits.type,
    rarity: preview.descriptor.traits.rarity,
    seed: preview.descriptor.seed,
    gifSha256: sha256(toHex(gif)),
    gifBytes: gif.length,
  });
}

await writeFile(`${outputDirectory}manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
