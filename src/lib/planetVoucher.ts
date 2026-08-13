import { getAddress, type Hex, isAddress, isHex } from 'viem';
import { BACKEND_API_BASE_URL, backendApiFetch } from './backendApi';
import type { MintVoucher } from './megaPlanets';

type SerializedVoucher = Omit<MintVoucher, 'ticketId' | 'drawingId' | 'expiresAt'> & {
  ticketId: string;
  drawingId: string;
  expiresAt: string;
};

type VoucherResponse = {
  voucher: SerializedVoucher;
  signature: Hex;
};

export type PlanetVoucherErrorStage =
  | 'request'
  | 'configuration'
  | 'receipt'
  | 'authority'
  | 'artifact'
  | 'storage'
  | 'rate_limit';

export type PlanetVoucherErrorCode =
  | 'invalid_request'
  | 'service_not_configured'
  | 'rate_limited'
  | 'receipt_not_eligible'
  | 'ticket_not_authorized'
  | 'artifact_unavailable'
  | 'storage_unavailable';

/** Safe, typed failure returned by the voucher service before a wallet write. */
export class PlanetVoucherServiceError extends Error {
  public readonly stage: PlanetVoucherErrorStage;
  public readonly code: PlanetVoucherErrorCode;
  public readonly requestId: string;

  public constructor(
    stage: PlanetVoucherErrorStage,
    code: PlanetVoucherErrorCode,
    message: string,
    requestId: string,
  ) {
    super(message);
    this.name = 'PlanetVoucherServiceError';
    this.stage = stage;
    this.code = code;
    this.requestId = requestId;
  }
}

export { PlanetVoucherServiceError as PlanetVoucherError };

const VOUCHER_ERROR_STAGES: readonly PlanetVoucherErrorStage[] = [
  'request',
  'configuration',
  'receipt',
  'authority',
  'artifact',
  'storage',
  'rate_limit',
];
const VOUCHER_ERROR_CODES: readonly PlanetVoucherErrorCode[] = [
  'invalid_request',
  'service_not_configured',
  'rate_limited',
  'receipt_not_eligible',
  'ticket_not_authorized',
  'artifact_unavailable',
  'storage_unavailable',
];

function isVoucherErrorStage(value: unknown): value is PlanetVoucherErrorStage {
  return (
    typeof value === 'string' && VOUCHER_ERROR_STAGES.includes(value as PlanetVoucherErrorStage)
  );
}

function isVoucherErrorCode(value: unknown): value is PlanetVoucherErrorCode {
  return typeof value === 'string' && VOUCHER_ERROR_CODES.includes(value as PlanetVoucherErrorCode);
}

/** Narrows only the service errors whose message is safe to show in the UI. */
export function isPlanetVoucherServiceError(value: unknown): value is PlanetVoucherServiceError {
  return value instanceof PlanetVoucherServiceError;
}

function parseVoucherServiceError(value: unknown): PlanetVoucherServiceError | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const payload = value as Record<string, unknown>;
  const message =
    typeof payload.message === 'string'
      ? payload.message
      : typeof payload.error === 'string'
        ? payload.error
        : undefined;
  if (
    !message ||
    !isVoucherErrorStage(payload.stage) ||
    !isVoucherErrorCode(payload.code) ||
    typeof payload.requestId !== 'string'
  ) {
    return undefined;
  }
  return new PlanetVoucherServiceError(payload.stage, payload.code, message, payload.requestId);
}

export type PreparedMintVoucher = {
  voucher: MintVoucher;
  signature: Hex;
};

/** Local Vite development proxies this route; production may use a separate API origin. */
export const isPlanetVoucherServiceConfigured =
  import.meta.env.DEV || Boolean(BACKEND_API_BASE_URL);

function parseVoucher(value: unknown): PreparedMintVoucher {
  if (!value || typeof value !== 'object')
    throw new Error('Voucher service returned an invalid response.');
  const response = value as Partial<VoucherResponse>;
  const voucher = response.voucher;
  if (
    !voucher ||
    !isAddress(voucher.recipient) ||
    !isHex(voucher.originTxHash, { strict: true }) ||
    !isHex(voucher.seed, { strict: true }) ||
    !isHex(voucher.traitsHash, { strict: true }) ||
    !isHex(voucher.metadataHash, { strict: true }) ||
    !voucher.metadataURI ||
    !isHex(response.signature, { strict: true })
  ) {
    throw new Error('Voucher service returned malformed voucher data.');
  }
  try {
    return {
      voucher: {
        recipient: getAddress(voucher.recipient),
        ticketId: BigInt(voucher.ticketId),
        drawingId: BigInt(voucher.drawingId),
        originTxHash: voucher.originTxHash,
        seed: voucher.seed,
        traitsHash: voucher.traitsHash,
        metadataHash: voucher.metadataHash,
        metadataURI: voucher.metadataURI,
        expiresAt: BigInt(voucher.expiresAt),
      },
      signature: response.signature,
    };
  } catch {
    throw new Error('Voucher service returned invalid numeric voucher fields.');
  }
}

export async function requestPlanetVoucher(args: {
  transactionHash: Hex;
  logIndex: bigint;
  signal?: AbortSignal;
}): Promise<PreparedMintVoucher> {
  if (!isPlanetVoucherServiceConfigured)
    throw new Error('Planet voucher service is not configured.');
  if (args.logIndex > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Ticket log index exceeds the voucher service limit.');
  }
  const response = await backendApiFetch('/api/planets/vouchers', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      transactionHash: args.transactionHash,
      logIndex: Number(args.logIndex),
    }),
    signal: args.signal,
  });
  const payload = await response.json().catch(() => undefined);
  if (!response.ok) {
    const typedError = parseVoucherServiceError(payload);
    if (typedError) throw typedError;
    const message =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : 'Voucher service request failed.';
    throw new Error(message);
  }
  return parseVoucher(payload);
}
