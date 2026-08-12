import { describe, expect, it } from 'vitest';
import { loadStage2Config } from './stage2Config';

const environment = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/megaplanets',
  BASE_SEPOLIA_RPC_URL: 'https://rpc.example.test',
  MEGAPLANETS_CONTRACT_ADDRESS: '0x0000000000000000000000000000000000000004',
};

describe('public Stage 2 configuration', () => {
  it('ignores removed wallet-authentication environment values', () => {
    const config = loadStage2Config({
      ...environment,
      MEGAPLANETS_APP_ORIGIN: 'not-a-url',
      MEGAPLANETS_SESSION_TTL_SECONDS: 'not-a-duration',
    });

    expect(config).not.toHaveProperty('appOrigin');
    expect(config).not.toHaveProperty('sessionTtlSeconds');
  });
});
