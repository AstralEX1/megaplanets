import {
  createPlanetConfig,
  derivePlanetPreview,
  derivePlanetPreviewForType,
  deserializePlanetInput,
  isPlanetType,
  type PlanetTypeId,
  renderPlanetGif,
  type SerializedPlanetInput,
} from '@megaplanets/planet-generator';

type GenerateRequest = {
  requestId: string;
  input: SerializedPlanetInput;
  previewTypeId?: PlanetTypeId;
};
type GenerateResponse =
  | { requestId: string; gif: ArrayBuffer }
  | { requestId: string; error: string };

function isRequest(value: unknown): value is GenerateRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    'requestId' in value &&
    typeof value.requestId === 'string' &&
    value.requestId.length > 0 &&
    value.requestId.length <= 256 &&
    'input' in value &&
    (!('previewTypeId' in value) ||
      value.previewTypeId === undefined ||
      isPlanetType(value.previewTypeId))
  );
}

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  postMessage: (message: GenerateResponse, transfer?: Transferable[]) => void;
};

workerScope.onmessage = (event) => {
  const requestId =
    typeof event.data === 'object' &&
    event.data !== null &&
    'requestId' in event.data &&
    typeof event.data.requestId === 'string'
      ? event.data.requestId.slice(0, 256)
      : 'invalid';
  try {
    if (!isRequest(event.data)) throw new TypeError('Invalid GIF worker request.');
    const input = deserializePlanetInput(event.data.input);
    const config = createPlanetConfig();
    const previewTypeId = event.data.previewTypeId;
    const preview = previewTypeId
      ? derivePlanetPreviewForType(input, config, previewTypeId)
      : derivePlanetPreview(input, config);
    const transferable = renderPlanetGif(preview.visual).slice().buffer as ArrayBuffer;
    workerScope.postMessage({ requestId, gif: transferable }, [transferable]);
  } catch (error) {
    workerScope.postMessage({
      requestId,
      error: error instanceof Error ? error.message : 'Unknown GIF generation error.',
    });
  }
};
