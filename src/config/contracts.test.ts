import { stringToHex } from 'viem';
import { describe, expect, it } from 'vitest';
import {
  CHAIN,
  DEFAULT_REFERRER_ADDRESS,
  EXPLORER_NFT_URL,
  MEGAPLANETS_CONTRACT_ADDRESS,
  parseChainName,
  parseMegaPlanetsContractAddress,
  REFERRAL_SPLIT_FULL,
  REFERRER_ADDRESS,
  TICKET_SOURCE,
} from './contracts';

describe('MegaPlanets protocol invariants', () => {
  it('defaults a fresh checkout to Base Sepolia', () => {
    expect(CHAIN).toBe('testnet');
  });

  it('builds NFT detail links for the active Base Sepolia explorer', () => {
    expect(`${EXPLORER_NFT_URL}0xabc/7`).toBe('https://sepolia.basescan.org/nft/0xabc/7');
  });

  it('fails closed for an invalid chain setting', () => {
    expect(() => parseChainName('base-sepolia')).toThrow('VITE_CHAIN');
  });

  it('makes an invalid Planet contract override visible instead of falling back', () => {
    expect(() => parseMegaPlanetsContractAddress('not-an-address')).toThrow(
      'VITE_MEGAPLANETS_CONTRACT_ADDRESS',
    );
    expect(parseMegaPlanetsContractAddress(undefined)).toBeUndefined();
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

  it('does not fall back to a historical Planet contract deployment', () => {
    expect(
      MEGAPLANETS_CONTRACT_ADDRESS === undefined
        || MEGAPLANETS_CONTRACT_ADDRESS === '0x7a29bfD9d1A7a243A212d4E81bc9A52bE50fb9f2',
    ).toBe(true);
  });

});
