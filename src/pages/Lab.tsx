import {
  createPlanetConfig,
  derivePlanetPreview,
  derivePlanetPreviewForType,
  isPlanetType,
  type PlanetDescriptor,
  type PlanetInput,
  type PlanetPreview,
  type PlanetRenderDescriptor,
  PLANET_TYPE_CONFIGS,
  serializePlanetInput,
} from '@megaplanets/planet-generator';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/common/Button';
import { PlanetThumbnail } from '@/components/planets/PlanetThumbnail';

type FormState = {
  ticketId: string;
  drawingId: string;
  normals: string;
  bonusBall: string;
  originTxHash: string;
};
type GifState =
  | { status: 'idle' | 'loading'; url: null; error: null }
  | { status: 'ready'; url: string; error: null }
  | { status: 'error'; url: null; error: string };

const DEFAULT_FORM: FormState = {
  ticketId: '456',
  drawingId: '123',
  normals: '2, 7, 14, 22, 29',
  bonusBall: '9',
  originTxHash: '0x0000000000000000000000000000000000000000000000000000000000000001',
};

const LAB_PLANET_CONFIG = createPlanetConfig();

type TicketFields = Pick<PlanetInput, 'ticketId' | 'drawingId' | 'normals' | 'bonusBall'>;

function parseInput(form: FormState): TicketFields {
  return {
    ticketId: BigInt(form.ticketId),
    drawingId: BigInt(form.drawingId),
    normals: form.normals
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => !Number.isNaN(value)),
    bonusBall: Number(form.bonusBall),
  };
}

function randomInteger(minimum: number, maximumInclusive: number): number {
  const range = maximumInclusive - minimum + 1;
  if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximumInclusive) || range <= 0) {
    throw new RangeError('Invalid random integer range.');
  }
  const limit = Math.floor(0x1_0000_0000 / range) * range;
  const buffer = new Uint32Array(1);
  do crypto.getRandomValues(buffer);
  while ((buffer[0] ?? 0) >= limit);
  return minimum + ((buffer[0] ?? 0) % range);
}

function randomForm(): FormState {
  const normals = new Set<number>();
  while (normals.size < 5) normals.add(randomInteger(1, 40));
  return {
    ticketId: String(randomInteger(1, 9_999_999)),
    drawingId: String(randomInteger(1, 9_999)),
    normals: [...normals].sort((first, second) => first - second).join(', '),
    bonusBall: String(randomInteger(1, 24)),
    originTxHash: `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)), (value) =>
      value.toString(16).padStart(2, '0'),
    ).join('')}`,
  };
}

function derivePlanetPreviewForLab(
  input: TicketFields,
  originTxHash: string,
  previewTypeId?: string,
): PlanetPreview {
  const canonicalInput = {
    ...input,
    originTxHash: originTxHash as `0x${string}`,
  };
  if (previewTypeId !== undefined) {
    if (!isPlanetType(previewTypeId)) throw new RangeError('Unsupported Planet Type.');
    return derivePlanetPreviewForType(canonicalInput, LAB_PLANET_CONFIG, previewTypeId);
  }
  return derivePlanetPreview(canonicalInput, LAB_PLANET_CONFIG);
}

const INITIAL_INPUT = parseInput(DEFAULT_FORM);
const INITIAL_PREVIEW = derivePlanetPreviewForLab(INITIAL_INPUT, DEFAULT_FORM.originTxHash);
const INITIAL_DESCRIPTOR_DATA = INITIAL_PREVIEW.descriptor;
const INITIAL_TYPE_ID = INITIAL_DESCRIPTOR_DATA.traits.typeId;
const INITIAL_DESCRIPTOR = INITIAL_PREVIEW.visual;

export function Lab() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [descriptor, setDescriptor] = useState<PlanetRenderDescriptor>(INITIAL_DESCRIPTOR);
  const [selectedType, setSelectedType] = useState<string | null>(INITIAL_TYPE_ID);
  const [planetDescriptor, setPlanetDescriptor] =
    useState<PlanetDescriptor>(INITIAL_DESCRIPTOR_DATA);
  const [error, setError] = useState<string | null>(null);
  const [gifRequest, setGifRequest] = useState<{
    preview: PlanetPreview;
    previewTypeId?: string;
  } | null>(null);
  const [gif, setGif] = useState<GifState>({ status: 'idle', url: null, error: null });
  const planetName = planetDescriptor.traits.name;
  const displayedPalette =
    PLANET_TYPE_CONFIGS.find((type) => type.id === descriptor.traits.planetType)?.visual.paletteVariants.find(
      (variant) =>
        variant.colors.length === descriptor.traits.typePalette.length &&
        variant.colors.every((color, index) => color === descriptor.traits.typePalette[index]),
    ) ?? planetDescriptor.traits.palette;

  const draft = useMemo(() => {
    try {
      const input = parseInput(form);
      return { input, preview: derivePlanetPreviewForLab(input, form.originTxHash), error: null };
    } catch (cause) {
      return {
        input: null,
        preview: null,
        error: cause instanceof Error ? cause.message : 'Enter valid generator values.',
      };
    }
  }, [form]);

  useEffect(() => {
    if (!gifRequest) return;
    const requestId = `${gifRequest.preview.descriptor.seed}:${gifRequest.previewTypeId ?? 'canonical'}`;
    const worker = new Worker(new URL('../workers/planetGif.worker.ts', import.meta.url), {
      type: 'module',
    });
    let objectUrl: string | null = null;
    setGif({ status: 'loading', url: null, error: null });
    worker.onmessage = (
      event: MessageEvent<
        { requestId: string; gif: ArrayBuffer } | { requestId: string; error: string }
      >,
    ) => {
      if (event.data.requestId !== requestId) return;
      if ('error' in event.data) {
        setGif({ status: 'error', url: null, error: event.data.error });
        return;
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(new Blob([event.data.gif], { type: 'image/gif' }));
      setGif({ status: 'ready', url: objectUrl, error: null });
    };
    worker.onerror = (event) =>
      setGif({ status: 'error', url: null, error: event.message || 'GIF worker failed.' });
    worker.postMessage({
      requestId,
      input: serializePlanetInput(gifRequest.preview.descriptor.input),
      previewTypeId: gifRequest.previewTypeId,
    });
    return () => {
      worker.terminate();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [gifRequest]);

  function update(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }
  function selectDescriptor(preview: PlanetPreview, nextForm: FormState, previewTypeId?: string) {
    setForm(nextForm);
    setDescriptor(preview.visual);
    setPlanetDescriptor(preview.descriptor);
    setGifRequest({ preview, previewTypeId });
    setSelectedType(previewTypeId ?? preview.descriptor.traits.typeId);
    setError(null);
  }
  function createPlanet() {
    if (!draft.input || !draft.preview) {
      setError(draft.error);
      return;
    }
    selectDescriptor(draft.preview, form);
  }
  function quickRandom() {
    const nextForm = randomForm();
    try {
      const input = parseInput(nextForm);
      const preview = derivePlanetPreviewForLab(input, nextForm.originTxHash);
      const type = PLANET_TYPE_CONFIGS.find((entry) => entry.id === preview.descriptor.traits.typeId);
      if (!type) throw new Error('Random Type selection exceeded the configured Types.');
      selectDescriptor(preview, nextForm);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create a random planet.');
    }
  }
  function generateType(typeId: string) {
    if (!isPlanetType(typeId)) return;
    const candidate = randomForm();
    const input = parseInput(candidate);
    const preview = derivePlanetPreviewForLab(input, candidate.originTxHash, typeId);
    selectDescriptor(preview, candidate, typeId);
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <section className="card-pad space-y-4">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary-400">
            Planet generator
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Planet Lab</h1>
          <p className="mt-2 text-sm text-zinc-400">
            The original animated renderer, with rotating terrain, clouds, satellites and rings.
          </p>
        </header>
        <div>
          <p className="mb-2 text-sm text-zinc-300">Generate a Type</p>
          <div className="grid grid-cols-2 gap-2">
            {PLANET_TYPE_CONFIGS.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => generateType(type.id)}
                className={`rounded border px-2 py-2 text-left text-xs transition ${selectedType === type.id ? 'border-brand-primary-400 bg-brand-primary-950/40' : 'border-[#3c4475] bg-[#050610] hover:border-brand-primary-400'}`}
              >
                <span
                  className="mr-1 inline-block h-2 w-2 rounded-full"
                  style={{
                    background: type.visual.paletteVariants.at(-1)?.colors.at(-1) ?? '#7c3aed',
                  }}
                />
                {type.publicName}
              </button>
            ))}
          </div>
        </div>
        <label className="block text-sm text-zinc-300">
          Ticket ID
          <input
            value={form.ticketId}
            onChange={(event) => update('ticketId', event.target.value)}
            inputMode="numeric"
            className="mt-1 w-full rounded border border-[#3c4475] bg-[#050610] px-3 py-2 font-mono text-white"
          />
        </label>
        <label className="block text-sm text-zinc-300">
          Drawing ID
          <input
            value={form.drawingId}
            onChange={(event) => update('drawingId', event.target.value)}
            inputMode="numeric"
            className="mt-1 w-full rounded border border-[#3c4475] bg-[#050610] px-3 py-2 font-mono text-white"
          />
        </label>
        <label className="block text-sm text-zinc-300">
          Five normal balls
          <input
            value={form.normals}
            onChange={(event) => update('normals', event.target.value)}
            className="mt-1 w-full rounded border border-[#3c4475] bg-[#050610] px-3 py-2 font-mono text-white"
          />
        </label>
        <label className="block text-sm text-zinc-300">
          Bonus ball
          <input
            value={form.bonusBall}
            onChange={(event) => update('bonusBall', event.target.value)}
            inputMode="numeric"
            className="mt-1 w-full rounded border border-[#3c4475] bg-[#050610] px-3 py-2 font-mono text-white"
          />
        </label>
        <label className="block text-sm text-zinc-300">
          Origin transaction hash
          <input
            value={form.originTxHash}
            onChange={(event) => update('originTxHash', event.target.value)}
            spellCheck={false}
            className="mt-1 w-full rounded border border-[#3c4475] bg-[#050610] px-3 py-2 font-mono text-white"
          />
        </label>
        {(error ?? draft.error) && (
          <p className="rounded border border-rose-900 bg-rose-950/50 px-3 py-2 text-sm text-rose-200">
            {error ?? draft.error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={createPlanet} disabled={!draft.input}>
            Create planet
          </Button>
          <Button variant="secondary" onClick={quickRandom}>
            Quick random
          </Button>
        </div>
      </section>
      <section className="card-pad space-y-4">
        <div className="overflow-hidden rounded-lg border border-[#3c4475] bg-[#050610]">
          {gif.status === 'ready' ? (
            <img
              src={gif.url}
              alt={`Animated planet for ticket ${descriptor.input.ticketId.toString()}`}
              className="aspect-square w-full"
              style={{ imageRendering: 'pixelated' }}
            />
          ) : (
            <div className="relative">
              <PlanetThumbnail descriptor={descriptor} />
              {gif.status === 'loading' && (
                <div className="absolute inset-x-0 bottom-0 bg-[#050610]/85 px-3 py-2 text-center text-sm text-zinc-300">
                  Encoding animated GIF…
                </div>
              )}
            </div>
          )}
        </div>
        {gif.status === 'error' && <p className="text-sm text-rose-300">{gif.error}</p>}
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-4">
            <p className="text-zinc-500">Name</p>
            <p className="font-medium text-white">{planetName}</p>
          </div>
          <div>
            <p className="text-zinc-500">Type</p>
            <p>{PLANET_TYPE_CONFIGS.find((type) => type.id === selectedType)?.publicName ?? 'Random'}</p>
          </div>
          <div>
            <p className="text-zinc-500">Terrain</p>
            <p>{descriptor.traits.noiseMode}</p>
          </div>
          <div className="col-span-2 sm:col-span-4">
            <p className="text-zinc-500">Palette</p>
            <p>{displayedPalette.name ?? 'Unnamed palette'}</p>
            <fieldset className="mt-2 flex gap-2" aria-label="Palette colors">
              {displayedPalette.colors.map((color) => (
                <span
                  key={color}
                  className="h-5 w-5 rounded border border-white/20"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </fieldset>
          </div>
          <div>
            <p className="text-zinc-500">Rarity</p>
            <p>{planetDescriptor.traits.rarity}</p>
          </div>
          <div>
            <p className="text-zinc-500">Minerals</p>
            <p>{planetDescriptor.traits.minerals}</p>
          </div>
        </div>
        <p className="break-all font-mono text-xs text-zinc-500">seed {planetDescriptor.seed}</p>
      </section>
    </div>
  );
}
