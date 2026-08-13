import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import webmWasmModule from 'webm-wasm/dist/webm-wasm.js';
import { createPlanetScene, renderPlanetSceneFrame } from './render';
import { GENERATOR_CONFIG, WEBM_CONFIG } from './render-config';
import type { PlanetRenderDescriptor } from './visual-types';

const webmWasmFactory = (
  typeof webmWasmModule === 'function'
    ? webmWasmModule
    : (webmWasmModule as unknown as { default?: WebmFactory }).default
) as WebmFactory;

export type WebMRenderOptions = {
  maxBytes?: number;
};

export type WebMInspection = {
  width: number;
  height: number;
  frameCount: number;
  durationMs: number;
  codec: 'V_VP8';
};

const require = createRequire(import.meta.url);
let modulePromise: Promise<ReturnType<typeof webmWasmFactory>> | undefined;

async function initializeWebmModule() {
  const wasmPath = require.resolve('webm-wasm/dist/webm-wasm.wasm');
  const wasmBytes = await readFile(wasmPath);
  return new Promise<ReturnType<typeof webmWasmFactory>>((resolve, reject) => {
    let module: ReturnType<typeof webmWasmFactory> | undefined;
    try {
      module = webmWasmFactory({
        noInitialRun: true,
        wasmBinary: wasmBytes.buffer.slice(wasmBytes.byteOffset, wasmBytes.byteOffset + wasmBytes.byteLength),
        onRuntimeInitialized() {
          if (!module) return reject(new Error('WebM WASM module did not initialize.'));
          // Emscripten exposes a then-like property that recursively assimilates
          // the module when wrapped in a Promise.
          delete module.then;
          resolve(module);
        },
        onAbort: (reason: unknown) => reject(new Error(`WebM WASM encoder aborted: ${String(reason)}`)),
      });
    } catch (error) {
      reject(error);
    }
  });
}

async function getWebmModule() {
  modulePromise ??= initializeWebmModule();
  return modulePromise;
}

function assertWebmBounds(bytes: Uint8Array, maxBytes: number): void {
  if (bytes.byteLength > maxBytes) {
    throw new RangeError(`WebM artifact exceeds the configured size bound (${maxBytes} bytes).`);
  }
  if (bytes.byteLength < 4 || bytes[0] !== 0x1a || bytes[1] !== 0x45 || bytes[2] !== 0xdf || bytes[3] !== 0xa3) {
    throw new Error('WebM encoder returned an invalid EBML header.');
  }
}

function readElementSize(bytes: Uint8Array, offset: number): { value: number; length: number } | undefined {
  const first = bytes[offset];
  if (first === undefined || first === 0) return undefined;
  let mask = 0x80;
  let length = 1;
  while (length <= 8 && (first & mask) === 0) {
    mask >>>= 1;
    length += 1;
  }
  if (length > 8 || offset + length > bytes.length) return undefined;
  let value = first & (mask - 1);
  for (let index = 1; index < length; index += 1) value = value * 256 + (bytes[offset + index] ?? 0);
  return { value, length };
}

function readElementId(bytes: Uint8Array, offset: number): { value: number; length: number } | undefined {
  const first = bytes[offset];
  if (first === undefined || first === 0) return undefined;
  let mask = 0x80;
  let length = 1;
  while (length <= 4 && (first & mask) === 0) {
    mask >>>= 1;
    length += 1;
  }
  if (length > 4 || offset + length > bytes.length) return undefined;
  let value = first;
  for (let index = 1; index < length; index += 1) value = value * 256 + (bytes[offset + index] ?? 0);
  return { value, length };
}

function findElement(bytes: Uint8Array, id: readonly number[]): { start: number; end: number } | undefined {
  outer: for (let offset = 0; offset + id.length + 1 <= bytes.length; offset += 1) {
    for (let index = 0; index < id.length; index += 1) if (bytes[offset + index] !== id[index]) continue outer;
    const size = readElementSize(bytes, offset + id.length);
    if (!size || size.value === 127 || offset + id.length + size.length + size.value > bytes.length) continue;
    return { start: offset + id.length + size.length, end: offset + id.length + size.length + size.value };
  }
  return undefined;
}

function findTextElement(bytes: Uint8Array, id: readonly number[], expected: string): { start: number; end: number } | undefined {
  outer: for (let offset = 0; offset + id.length + 1 <= bytes.length; offset += 1) {
    for (let index = 0; index < id.length; index += 1) if (bytes[offset + index] !== id[index]) continue outer;
    const size = readElementSize(bytes, offset + id.length);
    if (!size || size.value === 127 || offset + id.length + size.length + size.value > bytes.length) continue;
    const range = { start: offset + id.length + size.length, end: offset + id.length + size.length + size.value };
    if (new TextDecoder().decode(bytes.slice(range.start, range.end)) === expected) return range;
  }
  return undefined;
}

function readUnsigned(bytes: Uint8Array, range: { start: number; end: number }): number {
  let value = 0;
  for (let index = range.start; index < range.end; index += 1) value = value * 256 + (bytes[index] ?? 0);
  return value;
}

function countClusterFrames(bytes: Uint8Array): number {
  const cluster = findElement(bytes, [0x1f, 0x43, 0xb6, 0x75]);
  if (!cluster) return 0;
  let count = 0;
  let offset = cluster.start;
  while (offset < cluster.end) {
    const id = readElementId(bytes, offset);
    if (!id) break;
    const size = readElementSize(bytes, offset + id.length);
    if (!size || size.value === 127) break;
    const payloadStart = offset + id.length + size.length;
    const payloadEnd = payloadStart + size.value;
    if (payloadEnd > cluster.end) break;
    if (id.value === 0xa3) count += 1;
    offset = payloadEnd;
  }
  return count;
}

function countSimpleBlocks(bytes: Uint8Array): number {
  let count = 0;
  for (let offset = 0; offset + 1 < bytes.length; offset += 1) {
    if (bytes[offset] !== 0xa3) continue;
    const size = readElementSize(bytes, offset + 1);
    if (size && size.value !== 127 && offset + 1 + size.length + size.value <= bytes.length) count += 1;
  }
  return count;
}

/** libwebm writes a fresh SegmentUID for each encoder instance; canonicalize it
 * so retries can safely reuse the immutable artifact key. */
function canonicalizeWebmHeader(bytes: Uint8Array): Uint8Array {
  const normalized = new Uint8Array(bytes);
  for (let offset = 0; offset + 2 < normalized.length; offset += 1) {
    if (normalized[offset] !== 0x73 || normalized[offset + 1] !== 0xc5) continue;
    const size = readElementSize(normalized, offset + 2);
    if (!size || size.value === 127 || offset + 2 + size.length + size.value > normalized.length) continue;
    normalized.fill(0, offset + 2 + size.length, offset + 2 + size.length + size.value);
    break;
  }
  return normalized;
}

/** Inspect the minimum EBML structure needed to reject mislabeled or malformed media. */
export function inspectPlanetWebM(bytes: Uint8Array): WebMInspection {
  if (bytes.length < 4 || bytes[0] !== 0x1a || bytes[1] !== 0x45 || bytes[2] !== 0xdf || bytes[3] !== 0xa3) {
    throw new Error('WebM artifact does not start with an EBML header.');
  }
  const codec = findTextElement(bytes, [0x86], 'V_VP8');
  if (!codec) throw new Error('WebM artifact does not contain a VP8 video track.');
  const widthElement = findElement(bytes, [0xb0]);
  const heightElement = findElement(bytes, [0xba]);
  const durationElement = findElement(bytes, [0x44, 0x89]);
  if (!widthElement || !heightElement || !durationElement) throw new Error('WebM artifact is missing required video metadata.');
  const durationBytes = bytes.slice(durationElement.start, durationElement.end);
  const durationView = new DataView(durationBytes.buffer, durationBytes.byteOffset, durationBytes.byteLength);
  const duration = durationBytes.length === 4 ? durationView.getFloat32(0) : durationBytes.length === 8 ? durationView.getFloat64(0) : Number.NaN;
  if (!Number.isFinite(duration) || duration < 0) throw new Error('WebM artifact duration is invalid.');
  const frameCount = countClusterFrames(bytes) || countSimpleBlocks(bytes);
  if (frameCount < 1) throw new Error('WebM artifact contains no video frames.');
  return {
    width: readUnsigned(bytes, widthElement),
    height: readUnsigned(bytes, heightElement),
    frameCount,
    durationMs: duration,
    codec: 'V_VP8',
  };
}

/** Render the canonical visual into a real VP8/WebM container. */
export async function renderPlanetWebM(
  descriptor: PlanetRenderDescriptor,
  options: WebMRenderOptions = {},
): Promise<Uint8Array> {
  const maxBytes = options.maxBytes ?? WEBM_CONFIG.maxBytes;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new RangeError('maxBytes must be a positive safe integer.');
  if (WEBM_CONFIG.durationMs > WEBM_CONFIG.maxDurationMs) throw new Error('WebM duration exceeds the configured bound.');
  const scene = createPlanetScene(descriptor);
  const module = await getWebmModule();
  const chunks: Uint8Array[] = [];
  const encoder = new module.WebmEncoder(
    1,
    WEBM_CONFIG.frameRate,
    GENERATOR_CONFIG.outputSize,
    GENERATOR_CONFIG.outputSize,
    WEBM_CONFIG.bitrateKbps,
    false,
    false,
    (chunk: ArrayBuffer | Uint8Array) => chunks.push(chunk instanceof Uint8Array ? new Uint8Array(chunk) : new Uint8Array(chunk)),
  );
  try {
    for (let frameIndex = 0; frameIndex < WEBM_CONFIG.frameCount; frameIndex += 1) {
      const timeMs = (frameIndex * WEBM_CONFIG.durationMs) / WEBM_CONFIG.frameCount;
      const frame = renderPlanetSceneFrame(scene, timeMs, WEBM_CONFIG.durationMs);
      if (!encoder.addRGBAFrame(new Uint8Array(frame.data))) {
        throw new Error(`WebM encoder rejected frame ${frameIndex}: ${encoder.lastError()}`);
      }
    }
    if (!encoder.finalize()) throw new Error(`WebM encoder failed to finalize: ${encoder.lastError()}`);
  } finally {
    encoder.delete();
  }
  let bytes = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  bytes = new Uint8Array(canonicalizeWebmHeader(bytes));
  assertWebmBounds(bytes, maxBytes);
  const inspection = inspectPlanetWebM(bytes);
  if (inspection.width !== GENERATOR_CONFIG.outputSize || inspection.height !== GENERATOR_CONFIG.outputSize) {
    throw new Error('WebM artifact dimensions do not match the canonical render size.');
  }
  if (inspection.frameCount < WEBM_CONFIG.frameCount || inspection.durationMs > WEBM_CONFIG.maxDurationMs) {
    throw new Error(`WebM artifact exceeds the configured frame or duration bound (${inspection.frameCount} frames, ${inspection.durationMs}ms).`);
  }
  return bytes as Uint8Array<ArrayBuffer>;
}
type WebmFactory = typeof webmWasmModule;
