import { getAddress, isAddress, isHex, type Hex } from 'viem';
import type { MintVoucher } from './megaPlanets';
import { BACKEND_API_BASE_URL, backendApiFetch } from './backendApi';

type SerializedVoucher = Omit<MintVoucher, 'ticketId' | 'drawingId' | 'expiresAt'> & {
  ticketId: string;
  drawingId: string;
  expiresAt: string;
};

type VoucherResponse = {
  voucher: SerializedVoucher;
  signature: Hex;
};

export type PreparedMintVoucher = {
  voucher: MintVoucher;
  signature: Hex;
};

/** Local Vite development proxies this route; production may use a separate API origin. */
export const isPlanetVoucherServiceConfigured = import.meta.env.DEV || Boolean(BACKEND_API_BASE_URL);

function parseVoucher(value: unknown): PreparedMintVoucher {
  if (!value || typeof value !== 'object') throw new Error('Voucher service returned an invalid response.');
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
  if (!isPlanetVoucherServiceConfigured) throw new Error('Planet voucher service is not configured.');
  if (args.logIndex > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Ticket log index exceeds the voucher service limit.');
  }
  const response = await backendApiFetch('/api/planets/vouchers', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ transactionHash: args.transactionHash, logIndex: Number(args.logIndex) }),
    signal: args.signal,
  });
  const payload = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : 'Voucher service request failed.';
    throw new Error(message);
  }
  return parseVoucher(payload);
}
