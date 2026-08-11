import type { PlanetPreview } from '@megaplanets/planet-generator';
import type { ReactNode } from 'react';
import mineralIcon from '@/assets/mineral-icon.png';
import type { PlanetTicketStatus } from '@/hooks/usePlanetTicketStatuses';
import { formatMinerals } from '@/lib/minerals';
import { rarityBorderClass } from '@/lib/planetInventory';
import { PlanetThumbnail } from './PlanetThumbnail';
import { PlanetTicketStatusLabel } from './PlanetTicketStatusLabel';
import { UnrevealedPlanetVisual } from './UnrevealedPlanetVisual';

type PlanetInventoryCardProps = {
  preview: PlanetPreview;
  tokenId?: string;
  revealed: boolean;
  ticketStatus: PlanetTicketStatus;
  selected: boolean;
  onSelect: () => void;
  mintAction?: ReactNode;
  effectiveMineralsPerDayMicros?: string;
};

function rarityGlowClass(rarity: PlanetPreview['descriptor']['traits']['rarity']) {
  switch (rarity) {
    case 'Common': return 'drop-shadow-[0_0_10px_rgba(161,161,170,0.25)]';
    case 'Uncommon': return 'drop-shadow-[0_0_12px_rgba(52,211,153,0.34)]';
    case 'Epic': return 'drop-shadow-[0_0_14px_rgba(167,139,250,0.42)]';
    case 'Legendary': return 'drop-shadow-[0_0_16px_rgba(252,211,77,0.46)]';
  }
}

export function PlanetInventoryCard({
  preview,
  tokenId,
  revealed,
  ticketStatus,
  selected,
  onSelect,
  mintAction,
  effectiveMineralsPerDayMicros,
}: PlanetInventoryCardProps) {
  if (!revealed) {
    return (
      <article data-selected={selected ? 'true' : 'false'} className={`relative overflow-hidden rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-raised)] shadow-[0_18px_42px_rgba(0,0,0,0.52)] transition-[transform,box-shadow,background-color] duration-200 ${selected ? 'ring-2 ring-white ring-offset-2 ring-offset-[var(--background)]' : 'hover:-translate-y-1 hover:bg-[var(--surface-hover)] hover:shadow-[0_24px_52px_rgba(0,0,0,0.6)]'}`}>
        <button type="button" aria-label={`Select unrevealed Ticket #${preview.descriptor.input.ticketId.toString()}`} onClick={onSelect} className="absolute inset-0 z-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"><span className="sr-only">Select unrevealed ticket</span></button>
        <div className="pointer-events-none relative z-[1] space-y-3 p-3">
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <UnrevealedPlanetVisual className="aspect-square w-full" label="Unrevealed planet" />
          </div>
          <p className="font-mono text-[11px] text-[var(--text-secondary)]">Ticket #{preview.descriptor.input.ticketId.toString()}</p>
          <div className="flex items-center justify-between gap-2">
            <p className="telemetry text-[var(--text-primary)]"><PlanetTicketStatusLabel status={ticketStatus} /></p>
            {mintAction ? <div className="pointer-events-auto relative z-10 shrink-0 [&>div>p]:hidden [&>div>button]:w-auto">{mintAction}</div> : null}
          </div>
        </div>
      </article>
    );
  }

  const rarityClass = rarityBorderClass(preview.descriptor.traits.rarity);
  const rarityGlow = rarityGlowClass(preview.descriptor.traits.rarity);
  return (
    <article
      data-selected={selected ? 'true' : 'false'}
      data-rarity={preview.descriptor.traits.rarity}
      className={`relative overflow-hidden rounded-2xl border-[3px] bg-[var(--surface-raised)] shadow-[0_18px_42px_rgba(0,0,0,0.52)] transition-[transform,box-shadow,background-color,filter] duration-200 ${rarityClass} ${rarityGlow} ${selected ? 'ring-2 ring-white ring-offset-2 ring-offset-[var(--background)]' : 'hover:-translate-y-1 hover:bg-[var(--surface-hover)] hover:shadow-[0_26px_58px_rgba(0,0,0,0.64)]'}`}
    >
      {selected ? (
        <span className="pointer-events-none absolute top-2 right-2 z-10 rounded-full bg-white px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-black">
          Selected
        </span>
      ) : null}
      <button
        type="button"
        aria-label={`Select ${preview.descriptor.traits.name}`}
        onClick={onSelect}
        className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
      >
        <PlanetThumbnail descriptor={preview.visual} />
        <div className="space-y-2 p-3">
          <div className="flex items-start justify-between gap-2">
            <h2 className="min-w-0 truncate font-hud text-base font-bold text-[var(--text-primary)]">
              {preview.descriptor.traits.name}
            </h2>
            <p className="shrink-0 font-mono text-[11px] text-[var(--text-secondary)]">
              {tokenId ? `Planet #${tokenId}` : `Ticket #${preview.descriptor.input.ticketId.toString()}`}
            </p>
          </div>
          <div className="flex items-center justify-between gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <span className="inline-flex items-center gap-1.5">
              <img src={mineralIcon} alt="Minerals" className="h-5 w-5 object-contain invert" />
              <span>{effectiveMineralsPerDayMicros ? formatMinerals(BigInt(effectiveMineralsPerDayMicros)) : preview.descriptor.traits.minerals}</span>
            </span>
            <span className="telemetry text-right text-[var(--text-secondary)]"><PlanetTicketStatusLabel status={ticketStatus} /></span>
          </div>
        </div>
      </button>
    </article>
  );
}
