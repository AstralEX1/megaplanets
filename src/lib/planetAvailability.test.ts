import { describe, expect, it } from 'vitest';
import { getPlanetAvailability } from './planetAvailability';

describe('getPlanetAvailability', () => {
  const base = {
    walletConnected: true,
    walletChainId: 84_532,
    contractConfigured: true,
  };

  it('allows Planet actions only on a connected Base Sepolia wallet', () => {
    expect(getPlanetAvailability({ ...base, appChain: 'testnet' })).toBe('ready');
    expect(getPlanetAvailability({ ...base, appChain: 'testnet', walletChainId: 8453 })).toBe('wrong-chain');
    expect(getPlanetAvailability({ ...base, appChain: 'testnet', walletConnected: false })).toBe('disconnected');
  });

  it('fails closed for mainnet and missing Planet contract configuration', () => {
    expect(getPlanetAvailability({ ...base, appChain: 'mainnet' })).toBe('unsupported-mainnet');
    expect(getPlanetAvailability({ ...base, appChain: 'testnet', contractConfigured: false })).toBe('missing-contract');
  });
});
