declare module 'gifenc' {
  export type GifPalette = readonly (readonly [number, number, number])[];
  export type GifEncoder = {
    writeFrame(
      pixels: Uint8Array,
      width: number,
      height: number,
      options?: {
        palette?: GifPalette;
        delay?: number;
        repeat?: number;
      },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  };

  export function GIFEncoder(options?: { initialCapacity?: number }): GifEncoder;
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: GifPalette,
  ): Uint8Array;

  const gifenc: {
    GIFEncoder: typeof GIFEncoder;
    applyPalette: typeof applyPalette;
  };
  export default gifenc;
}
