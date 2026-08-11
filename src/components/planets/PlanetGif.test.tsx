// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { PlanetPreview } from '@megaplanets/planet-generator';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlanetGif } from './PlanetGif';

vi.mock('./PlanetThumbnail', () => ({ PlanetThumbnail: () => <span>Static planet fallback</span> }));

const preview = {
  descriptor: {
    input: {
      ticketId: 24n,
      drawingId: 218n,
      normals: [4, 11, 17, 26, 39],
      bonusBall: 66,
      originTxHash: `0x${'1234'.padStart(64, '0')}`,
    },
    seed: '0xseed',
    traits: { name: 'Kepler' },
  },
  visual: { input: { ticketId: 24n } },
} as unknown as PlanetPreview;

describe('PlanetGif', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps the static pixel preview when workers are unavailable', () => {
    vi.stubGlobal('Worker', undefined);
    render(<PlanetGif preview={preview} />);
    expect(screen.getByText('Static planet fallback')).toBeInTheDocument();
  });

  it('replaces the fallback with the generated animated GIF', async () => {
    class FakeWorker {
      onmessage: ((event: MessageEvent<{ requestId: string; gif: ArrayBuffer }>) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage(message: { requestId: string }) {
        queueMicrotask(() => this.onmessage?.({ data: { requestId: message.requestId, gif: new ArrayBuffer(2) } } as MessageEvent<{ requestId: string; gif: ArrayBuffer }>));
      }
      terminate() {}
    }
    vi.stubGlobal('Worker', FakeWorker);
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:planet-gif') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });

    render(<PlanetGif preview={preview} />);

    await waitFor(() => expect(screen.getByRole('img', { name: 'Animated planet Kepler' })).toHaveAttribute('src', 'blob:planet-gif'));
  });
});
