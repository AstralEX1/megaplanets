import { describe, expect, it } from 'vitest';
import { createPlanetConfig, derivePlanetPreview } from '../src/index';
import { GENERATOR_CONFIG, WEBM_CONFIG } from '../src/render-config';
import { inspectPlanetWebM, renderPlanetWebM } from '../src/webm';

const input = {
  ticketId: 456n,
  drawingId: 123n,
  normals: [2, 7, 14, 22, 29],
  bonusBall: 9,
  originTxHash: `0x${'aa'.repeat(32)}` as const,
};

describe('canonical WebM media', () => {
  it('renders deterministic playable WebM bytes with a bounded short duration and size', async () => {
    const preview = derivePlanetPreview(input, createPlanetConfig());
    const first = await renderPlanetWebM(preview.visual);
    const second = await renderPlanetWebM(preview.visual);

    expect(first).toEqual(second);
    expect(first.slice(0, 4)).toEqual(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]));
    expect(new TextDecoder().decode(first)).toContain('webm');
    expect(inspectPlanetWebM(first)).toMatchObject({
      width: 128,
      height: 128,
      durationMs: WEBM_CONFIG.durationMs,
      codec: 'V_VP8',
    });
    expect(inspectPlanetWebM(first).frameCount).toBeGreaterThanOrEqual(WEBM_CONFIG.frameCount);
    expect(first.byteLength).toBeGreaterThan(128);
    expect(first.byteLength).toBeLessThanOrEqual(WEBM_CONFIG.maxBytes);
    expect(WEBM_CONFIG.durationMs).toBeLessThanOrEqual(WEBM_CONFIG.maxDurationMs);
    expect(WEBM_CONFIG.durationMs).toBeLessThanOrEqual(5_000);
    expect(GENERATOR_CONFIG.durationMs).toBeGreaterThan(WEBM_CONFIG.durationMs);
  }, 30_000);

  it('rejects media that would exceed the configured frame and byte bounds', async () => {
    const preview = derivePlanetPreview(input, createPlanetConfig());
    await expect(renderPlanetWebM(preview.visual, { maxBytes: 1 })).rejects.toThrow(/size|bound/i);
  }, 30_000);

  it('inspects canonical dimensions without mistaking VP8 payload bytes for EBML metadata', async () => {
    const preview = derivePlanetPreview(
      {
        ticketId: 84987483494186223308452741869901919386957616058064076506619992595193256869168n,
        drawingId: 7734n,
        normals: [7, 11, 18, 20, 24],
        bonusBall: 7,
        originTxHash: '0x90e3118f5cb6c171cf0bb6192bf51c49d3e087a03eb5de2aa572e84fd7ae83e1',
      },
      createPlanetConfig(),
    );

    const bytes = await renderPlanetWebM(preview.visual);

    expect(inspectPlanetWebM(bytes)).toMatchObject({ width: 128, height: 128 });
  }, 30_000);
});
