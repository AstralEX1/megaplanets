import { describe, expect, it } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { assertMetadataSignerMatch, assertProductionDatabase } from './readiness';

const signer = privateKeyToAccount(`0x${'11'.repeat(32)}`).address;

describe('production voucher readiness guards', () => {
  it('rejects a missing database in production', () => {
    expect(() => assertProductionDatabase({ databaseUrl: undefined }, { NODE_ENV: 'production' })).toThrow(/PostgreSQL/i);
  });

  it('allows the local file store outside production', () => {
    expect(() => assertProductionDatabase({ databaseUrl: undefined }, { NODE_ENV: 'development' })).not.toThrow();
  });

  it('accepts a matching on-chain metadata signer', () => {
    expect(() => assertMetadataSignerMatch(signer, signer.toLowerCase() as `0x${string}`)).not.toThrow();
  });

  it('rejects a mismatched on-chain metadata signer', () => {
    expect(() => assertMetadataSignerMatch(signer, `0x${'22'.repeat(20)}`)).toThrow(/metadata signer/i);
  });
});
