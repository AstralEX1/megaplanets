import { getAddress, type Address } from 'viem';

/**
 * Production must use the durable PostgreSQL eligibility store. The local JSON
 * store remains available for development and one-process rehearsals only.
 */
export function assertProductionDatabase(
  config: { databaseUrl?: string },
  env: Record<string, string | undefined> = process.env,
): void {
  if ((env.NODE_ENV ?? '').trim().toLowerCase() === 'production' && !config.databaseUrl) {
    throw new Error('PostgreSQL DATABASE_URL is required for the production voucher service.');
  }
}

/** Fails readiness when the deployed contract signer differs from the API key. */
export function assertMetadataSignerMatch(expectedSigner: Address, chainSigner: Address): void {
  if (getAddress(expectedSigner) !== getAddress(chainSigner)) {
    throw new Error(`On-chain metadata signer ${chainSigner} does not match configured signer ${expectedSigner}.`);
  }
}
