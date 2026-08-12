import { describe, expect, it } from 'vitest';
import { loadStage5Config } from './config';

const baseEnvironment = {
  MEGAPLANETS_METADATA_SIGNER_PRIVATE_KEY: `0x${'11'.repeat(32)}`,
  BASE_SEPOLIA_RPC_URL: 'https://rpc.example.test',
  PINATA_JWT: 'test-pinata-token',
};

describe('Stage 5 confirmation configuration', () => {
  it('defaults receipt confirmation depth to six blocks', () => {
    expect(loadStage5Config(baseEnvironment).confirmations).toBe(6n);
  });

  it('reads a non-negative confirmation depth from the server environment', () => {
    expect(loadStage5Config({ ...baseEnvironment, MEGAPLANETS_CONFIRMATIONS: '12' }).confirmations).toBe(12n);
  });

  it('rejects malformed confirmation depth', () => {
    expect(() => loadStage5Config({ ...baseEnvironment, MEGAPLANETS_CONFIRMATIONS: '-1' })).toThrow(/confirmations/i);
    expect(() => loadStage5Config({ ...baseEnvironment, MEGAPLANETS_CONFIRMATIONS: 'not-a-number' })).toThrow(/confirmations/i);
  });
});
