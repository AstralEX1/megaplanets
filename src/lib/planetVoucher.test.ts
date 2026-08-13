import { afterEach, describe, expect, it, vi } from 'vitest';

const backendApiFetch = vi.hoisted(() => vi.fn());

vi.mock('./backendApi', () => ({
  BACKEND_API_BASE_URL: 'http://localhost:8787',
  backendApiFetch,
}));

import { requestPlanetVoucher } from './planetVoucher';

const transactionHash = `0x${'a'.repeat(64)}` as `0x${string}`;

describe('requestPlanetVoucher', () => {
  afterEach(() => backendApiFetch.mockReset());

  it('preserves safe API stage, code, message, and request ID on voucher failures', async () => {
    backendApiFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'Ticket is not eligible for a Planet voucher.',
          stage: 'receipt',
          code: 'receipt_not_eligible',
          message: 'Ticket is not eligible for a Planet voucher.',
          requestId: 'reveal-218-5',
        }),
        { status: 422, headers: { 'content-type': 'application/json' } },
      ),
    );

    await expect(requestPlanetVoucher({ transactionHash, logIndex: 5n })).rejects.toMatchObject({
      name: 'PlanetVoucherServiceError',
      message: 'Ticket is not eligible for a Planet voucher.',
      stage: 'receipt',
      code: 'receipt_not_eligible',
      requestId: 'reveal-218-5',
    });
  });

  it('falls back to a safe generic error when a failed response has no typed payload', async () => {
    backendApiFetch.mockResolvedValue(new Response('upstream unavailable', { status: 503 }));

    await expect(requestPlanetVoucher({ transactionHash, logIndex: 5n })).rejects.toThrow(
      'Voucher service request failed.',
    );
  });
});
