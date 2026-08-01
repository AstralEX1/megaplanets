declare module 'gifenc' {
  export function GIFEncoder(options?: { initialCapacity?: number }): {
    writeFrame(
      pixels: Uint8Array,
      width: number,
      height: number,
      options?: {
        palette?: readonly (readonly [number, number, number])[];
        delay?: number;
        repeat?: number;
      },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  };

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: readonly (readonly [number, number, number])[],
  ): Uint8Array;

  const gifenc: {
    GIFEncoder: typeof GIFEncoder;
    applyPalette: typeof applyPalette;
  };
  export default gifenc;
}
