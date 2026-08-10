import { stringToHex } from 'viem';
import { describe, expect, it } from 'vitest';
import {
  CHAIN,
  DEFAULT_REFERRER_ADDRESS,
  LP_ENABLED,
  parseChainName,
  REFERRAL_SPLIT_FULL,
  REFERRER_ADDRESS,
  TICKET_SOURCE,
} from './contracts';

describe('MegaPlanets protocol invariants', () => {
  it('defaults a fresh checkout to Base Sepolia', () => {
    expect(CHAIN).toBe('testnet');
  });

  it('fails closed for an invalid chain setting', () => {
    expect(() => parseChainName('base-sepolia')).toThrow('VITE_CHAIN');
  });

  it('uses the immutable MegaPlanets ticket source', () => {
    expect(TICKET_SOURCE).toBe(stringToHex('MEGAPLANETS_V1', { size: 32 }));
  });

  it('allocates the full referral split to the configured application referrer', () => {
    expect(REFERRAL_SPLIT_FULL).toEqual([1_000_000_000_000_000_000n]);
  });

  it('uses the approved public MegaPlanets referrer by default', () => {
    expect(REFERRER_ADDRESS).toBe(DEFAULT_REFERRER_ADDRESS);
  });

  it('keeps the LP surface disabled for the MVP', () => {
    expect(LP_ENABLED).toBe(false);
  });
});
