import type { PlanetPreview } from '@megaplanets/planet-generator';
import type { ReactNode } from 'react';
import mineralIcon from '@/assets/mineral-icon.png';
import { Button } from '@/components/common/Button';
import type { PlanetTicketStatus } from '@/hooks/usePlanetTicketStatuses';
import type { PlanetMiningSnapshot } from '@/hooks/useWalletMining';
import { formatMinerals } from '@/lib/minerals';
import { LiveMineralAmount } from './LiveMineralAmount';
import { PlanetGif } from './PlanetGif';
import { PlanetTicketStatusLabel } from './PlanetTicketStatusLabel';
import { UnrevealedPlanetVisual } from './UnrevealedPlanetVisual';

type PlanetInventoryDetailProps = {
  preview: PlanetPreview;
  tokenId?: string;
  revealed: boolean;
  ticketStatus: PlanetTicketStatus;
  mintAction: ReactNode;
  onStatusAction?: () => void;
  statusPending?: boolean;
  onViewDetails?: () => void;
  onBack?: () => void;
  mining?: PlanetMiningSnapshot;
  miningAsOf?: string;
};

function humanize(value: string) {
  const words = value.replaceAll('-', ' ');
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

function Trait({ label, value, dataTrait }: { label: string; value: ReactNode; dataTrait?: string }) {
  return (
    <div className="border-b border-[var(--border)] py-2 last:border-b-0">
      <dt className="telemetry text-[var(--text-secondary)]">{label}</dt>
      <dd data-trait={dataTrait} className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{value}</dd>
    </div>
  );
}

function TicketCoordinates({ preview }: { preview: PlanetPreview }) {
  const input = preview.descriptor.input;
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <p className="telemetry text-[var(--text-secondary)]">Ticket coordinates</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {input.normals.map((coordinate) => (
          <span key={coordinate} className="grid h-8 w-8 place-items-center rounded-full border border-[var(--border-strong)] bg-[var(--surface-raised)] font-mono text-xs font-bold text-[var(--text-primary)]">
            {coordinate}
          </span>
        ))}
        <span aria-hidden className="mx-1 h-7 w-px bg-[var(--border-strong)]" />
        <span data-coordinate="bonus" className="grid h-9 w-9 place-items-center rounded-full bg-[var(--rare)] font-mono text-xs font-bold text-black" title="Bonus number">
          {input.bonusBall}
        </span>
      </div>
    </div>
  );
}

export function PlanetInventoryDetail({
  preview,
  tokenId,
  revealed,
  ticketStatus,
  mintAction,
  onStatusAction,
  statusPending = false,
  onViewDetails,
  onBack,
  mining,
  miningAsOf,
}: PlanetInventoryDetailProps) {
  if (!revealed) {
    return (
      <section className="rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-raised)] p-4 sm:p-5">
        {onBack ? <button type="button" onClick={onBack} className="mb-4 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">← Back to My Planets</button> : null}
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <UnrevealedPlanetVisual className="aspect-square w-full" label="Unrevealed planet" />
        </div>
        <div className="mt-5">
          <p className="font-mono text-xs text-[var(--text-secondary)]">Ticket #{preview.descriptor.input.ticketId.toString()}</p>
          <Button variant="secondary" size="lg" className="mt-3 w-full" disabled={ticketStatus.kind === 'unavailable'} onClick={onStatusAction}>
            <PlanetTicketStatusLabel status={ticketStatus} />
          </Button>
        </div>
        <div className="mt-5"><TicketCoordinates preview={preview} /></div>
        <div className="mt-5 [&>div>p]:hidden [&>div>button]:w-full">{mintAction}</div>
      </section>
    );
  }

  const { descriptor } = preview;
  return (
    <section data-density="compact" className="rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-raised)] p-4">
      {onBack ? <button type="button" onClick={onBack} className="mb-4 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">← Back to My Planets</button> : null}
      <div data-planet-art className="mx-auto aspect-square max-h-[32vh] w-full max-w-[32vh] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <PlanetGif preview={preview} />
      </div>

      <div className="mt-3">
        <p className="telemetry text-[var(--text-secondary)]">{descriptor.traits.type}</p>
        <h1 className="mt-1 font-hud text-2xl font-bold tracking-[-0.04em] text-[var(--text-primary)] sm:text-3xl">
          {descriptor.traits.name}
        </h1>
        <p className="mt-1 inline-flex items-center gap-2 text-base font-semibold text-[var(--text-primary)]">
          <img src={mineralIcon} alt="Minerals" className="h-6 w-6 object-contain invert" />
          {descriptor.traits.minerals}
        </p>
      </div>

      {mining && miningAsOf ? (
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">
          <LiveMineralAmount
            prefix="Mined"
            snapshotMicros={mining.earnedMicros}
            effectiveMineralsPerDayMicros={mining.effectiveMineralsPerDayMicros}
            asOf={miningAsOf}
            className="col-span-2 font-hud text-lg font-bold text-[var(--text-primary)]"
          />
          <p className="text-[var(--text-secondary)]">Base rate <span className="font-semibold text-[var(--text-primary)]">{mining.baseMineralsPerDay}</span></p>
          <p className="text-[var(--text-secondary)]">Same-Type bonus <span className="font-semibold text-[var(--text-primary)]">+{(Number(mining.multiplierBps) - 10_000) / 100}%</span></p>
          <p className="col-span-2 text-[var(--text-secondary)]">Effective rate <span className="font-semibold text-[var(--text-primary)]">{formatMinerals(BigInt(mining.effectiveMineralsPerDayMicros))} / day</span></p>
        </div>
      ) : null}

      <Button
        variant="primary"
        size="lg"
        className="mt-3 w-full text-center"
        disabled={ticketStatus.kind === 'unavailable' || statusPending}
        onClick={onStatusAction}
      >
        <PlanetTicketStatusLabel status={ticketStatus} />
      </Button>

      <dl className="mt-3 grid grid-cols-3 gap-x-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3">
        <Trait label="Terrain" value={humanize(descriptor.traits.terrain)} />
        <Trait label="Type" value={descriptor.traits.type} />
        <Trait label="Satellites" value={descriptor.traits.satelliteCount} />
        <Trait label="Clouds" value={preview.visual.traits.hasClouds ? 'Yes' : 'No'} dataTrait="clouds" />
        <Trait label="Rings" value={descriptor.traits.hasRing ? 'Yes' : 'No'} dataTrait="rings" />
        <Trait label="Rarity" value={descriptor.traits.rarity} />
      </dl>

      <div className="mt-3"><TicketCoordinates preview={preview} /></div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
        <div className="space-y-1 font-mono text-xs text-[var(--text-secondary)]">
          <p>Ticket #{descriptor.input.ticketId.toString()}</p>
          {tokenId ? <p>Planet #{tokenId}</p> : null}
        </div>
        {tokenId && onViewDetails ? <Button variant="secondary" size="sm" onClick={onViewDetails}>View details</Button> : null}
      </div>
    </section>
  );
}
