declare module 'webm-wasm/dist/webm-wasm.js' {
  type WebmEncoder = {
    addRGBAFrame(frame: Uint8Array | ArrayBuffer): boolean;
    finalize(): boolean;
    delete(): void;
    lastError(): string;
  };

  type WebmModule = {
    WebmEncoder: new (
      timebaseNum: number,
      timebaseDen: number,
      width: number,
      height: number,
      bitrate: number,
      realtime: boolean,
      kLive: boolean,
      callback: (chunk: ArrayBuffer | Uint8Array) => void,
    ) => WebmEncoder;
    then?: unknown;
  };

  type WebmFactory = (options: {
    noInitialRun: boolean;
    wasmBinary: ArrayBuffer;
    onRuntimeInitialized: () => void;
    onAbort?: (reason: unknown) => void;
  }) => WebmModule;

  const factory: WebmFactory;
  export default factory;
}
