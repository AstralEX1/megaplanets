import type { ReactNode } from 'react';
import type { PlanetPreview } from '@megaplanets/planet-generator';
import { drawingStatusLabel } from '@/hooks/usePlanetDrawingStates';
import type { RoundStatus } from '@/lib/api';
import { PlanetThumbnail } from './PlanetThumbnail';

export function PlanetInventoryCard({ preview, revealed, drawingStatus, selected, onSelect, mintAction }: { preview: PlanetPreview; revealed: boolean; drawingStatus: RoundStatus | undefined; selected: boolean; onSelect: () => void; mintAction?: ReactNode }) {
  return (
    <article className={`overflow-hidden rounded-[16px] border bg-[var(--surface-raised)] transition-colors ${selected ? 'border-[var(--rare)] shadow-[0_0_0_1px_var(--rare)]' : 'border-[var(--border-strong)] hover:border-[var(--text-secondary)]'}`}>
      {revealed ? <button type="button" aria-label={`Select ${preview.descriptor.traits.name}`} onClick={onSelect} className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--text-primary)]">
        <PlanetThumbnail descriptor={preview.visual} />
        <div className="space-y-2 p-3">
          <div><h2 className="font-hud text-lg font-bold text-[var(--text-primary)]">{preview.descriptor.traits.name}</h2><p className="telemetry mt-1 text-[var(--rare)]">{preview.descriptor.traits.type}</p></div><p className="text-sm font-semibold text-[var(--text-primary)]">{preview.descriptor.traits.minerals} minerals/day</p>
          <p className="telemetry text-[var(--text-secondary)]">{drawingStatusLabel(drawingStatus)}</p>
        </div>
      </button> : <div className="space-y-4 p-4"><p className="telemetry text-[var(--text-primary)]">{drawingStatusLabel(drawingStatus)}</p>{mintAction && <div className="[&>div>p]:hidden [&>div>button]:w-full">{mintAction}</div>}</div>}
    </article>
  );
}
