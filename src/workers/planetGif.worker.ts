import {
  derivePlanet,
  deserializePlanetInput,
  renderPlanetGif,
  type SerializedPlanetTicketInput,
} from '@megaplanets/planet-generator';

type GenerateRequest = { requestId: string; input: SerializedPlanetTicketInput };
type GenerateResponse =
  | { requestId: string; gif: ArrayBuffer }
  | { requestId: string; error: string };

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<GenerateRequest>) => void) | null;
  postMessage: (message: GenerateResponse, transfer?: Transferable[]) => void;
};

workerScope.onmessage = (event) => {
  const { requestId, input } = event.data;
  try {
    const gif = renderPlanetGif(derivePlanet(deserializePlanetInput(input)));
    const transferable = gif.slice().buffer as ArrayBuffer;
    workerScope.postMessage({ requestId, gif: transferable }, [transferable]);
  } catch (error) {
    workerScope.postMessage({
      requestId,
      error: error instanceof Error ? error.message : 'Unknown GIF generation error.',
    });
  }
};
