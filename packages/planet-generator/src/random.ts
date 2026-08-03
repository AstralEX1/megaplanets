import { concatHex, hexToBigInt, hexToBytes, keccak256, stringToHex, toHex } from 'viem';
import type { Hex } from './visual-types';

const UINT256_RANGE = 1n << 256n;
const BYTES32_PATTERN = /^0x[\da-fA-F]{64}$/;

/** Local deterministic stream. It never reads or mutates Math.random. */
export class DeterministicRandom {
  readonly streamSeed: Hex;
  private counter = 0n;
  private bytes: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
  private byteOffset = 0;

  constructor(seed: Hex, namespace: string) {
    if (!BYTES32_PATTERN.test(seed)) {
      throw new RangeError('seed must be a 0x-prefixed bytes32 hex value.');
    }
    if (namespace.length === 0 || namespace.length > 128) {
      throw new RangeError('Random namespace must contain between 1 and 128 characters.');
    }
    this.streamSeed = keccak256(concatHex([seed, stringToHex(namespace)]));
  }

  private nextBlockHex(): Hex {
    const block = keccak256(concatHex([this.streamSeed, toHex(this.counter, { size: 32 })]));
    this.counter += 1n;
    return block;
  }

  private nextBlock(): Uint8Array {
    return hexToBytes(this.nextBlockHex());
  }

  nextUint32(): number {
    if (this.byteOffset + 4 > this.bytes.length) {
      this.bytes = this.nextBlock();
      this.byteOffset = 0;
    }
    const value =
      this.bytes[this.byteOffset] * 0x1000000 +
      this.bytes[this.byteOffset + 1] * 0x10000 +
      this.bytes[this.byteOffset + 2] * 0x100 +
      this.bytes[this.byteOffset + 3];
    this.byteOffset += 4;
    return value;
  }

  next(): number {
    return this.nextUint32() / 0x100000000;
  }

  int(min: number, maxExclusive: number): number {
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(maxExclusive) || maxExclusive <= min) {
      throw new RangeError('Invalid deterministic integer range.');
    }
    if (maxExclusive - min > 0x1_0000_0000) {
      throw new RangeError('Deterministic integer ranges may not exceed 2^32 values.');
    }
    return min + Math.floor(this.next() * (maxExclusive - min));
  }

  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  bigint(maxExclusive: bigint): bigint {
    if (maxExclusive <= 0n) throw new RangeError('maxExclusive must be positive.');
    const limit = UINT256_RANGE - (UINT256_RANGE % maxExclusive);
    for (;;) {
      const value = hexToBigInt(this.nextBlockHex());
      if (value < limit) return value % maxExclusive;
    }
  }

  bigintInclusive(min: bigint, max: bigint): bigint {
    if (max < min) throw new RangeError('Invalid deterministic bigint range.');
    return min + this.bigint(max - min + 1n);
  }

  weightedIndex(weights: readonly number[]): number {
    if (
      weights.length === 0 ||
      weights.some((weight) => !Number.isSafeInteger(weight) || weight < 0)
    ) {
      throw new RangeError('Weights must be non-negative integers.');
    }
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (!Number.isSafeInteger(total) || total <= 0) {
      throw new RangeError('Weight total must be a positive safe integer.');
    }
    let target = Number(this.bigint(BigInt(total)));
    for (let index = 0; index < weights.length; index += 1) {
      if (target < weights[index]) return index;
      target -= weights[index];
    }
    throw new Error('Weighted selection exceeded its configured range.');
  }
}

export function namedVisualRandom(seed: Hex, namespace: string): DeterministicRandom {
  return new DeterministicRandom(seed, `MEGAPLANETS_GENERATOR:visual:${namespace}`);
}
