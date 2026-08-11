import type { PlanetPreview } from '@megaplanets/planet-generator';
import type { ReactNode } from 'react';
import { Button } from '@/components/common/Button';
import {
  EXPLORER_NFT_URL,
  EXPLORER_TX_URL,
  MEGAPLANETS_CONTRACT_ADDRESS,
} from '@/config/contracts';
import type { PlanetTicketStatus } from '@/hooks/usePlanetTicketStatuses';
import type { PlanetMiningSnapshot } from '@/hooks/useWalletMining';
import { PlanetMiningOverlay } from './PlanetMiningOverlay';
import { PlanetGif } from './PlanetGif';
import { PlanetTicketStatusLabel } from './PlanetTicketStatusLabel';
import { UnrevealedPlanetVisual } from './UnrevealedPlanetVisual';

type PlanetInventoryDetailProps = {
  preview: PlanetPreview;
  tokenId?: string;
  ticketTxHash?: string;
  revealed: boolean;
  ticketStatus: PlanetTicketStatus;
  mintAction: ReactNode;
  onClaim?: () => void;
  statusPending?: boolean;
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

function TicketLifecycle({
  status,
  onClaim,
  pending,
}: {
  status: PlanetTicketStatus;
  onClaim?: () => void;
  pending: boolean;
}) {
  if (status.kind === 'claim') {
    return (
      <Button variant="primary" size="lg" className="w-full" disabled={pending} onClick={onClaim}>
        <PlanetTicketStatusLabel status={status} />
      </Button>
    );
  }
  return (
    <div data-ticket-lifecycle={status.kind} className="flex min-h-12 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-primary)]">
      <PlanetTicketStatusLabel status={status} />
    </div>
  );
}

function ExplorerLink({ href, label }: { href?: string; label: string }) {
  if (!href) {
    return <span aria-label={`${label} unavailable`} className="rounded-2xl border border-[var(--border)] px-3 py-3 text-center text-[var(--text-secondary)]">{label} unavailable</span>;
  }
  return <a href={href} target="_blank" rel="noreferrer" aria-label={label} className="rounded-2xl border border-[var(--border-strong)] px-3 py-3 text-center text-[var(--rare)] hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rare)]">{label}</a>;
}

export function PlanetInventoryDetail({
  preview,
  tokenId,
  ticketTxHash,
  revealed,
  ticketStatus,
  mintAction,
  onClaim,
  statusPending = false,
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
          <div className="mt-3"><TicketLifecycle status={ticketStatus} onClaim={onClaim} pending={statusPending} /></div>
        </div>
        <div className="mt-5"><TicketCoordinates preview={preview} /></div>
        <div className="mt-5 [&>div>p]:hidden [&>div>button]:w-full">{mintAction}</div>
      </section>
    );
  }

  const { descriptor } = preview;
  const ticketExplorerUrl = ticketTxHash ? `${EXPLORER_TX_URL}${ticketTxHash}` : undefined;
  const nftExplorerUrl = tokenId && MEGAPLANETS_CONTRACT_ADDRESS
    ? `${EXPLORER_NFT_URL}${MEGAPLANETS_CONTRACT_ADDRESS}/${tokenId}`
    : undefined;

  return (
    <section data-density="compact" className="rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-raised)] p-4">
      {onBack ? <button type="button" onClick={onBack} className="mb-4 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">← Back to My Planets</button> : null}
      <div data-testid="planet-artwork" className="relative mx-auto aspect-square max-h-[32vh] w-full max-w-[32vh] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <PlanetGif preview={preview} />
        <PlanetMiningOverlay mining={mining} miningAsOf={miningAsOf} />
      </div>

      <div className="mt-3">
        <p className="telemetry text-[var(--text-secondary)]">{descriptor.traits.type}</p>
        <h1 className="mt-1 font-hud text-2xl font-bold tracking-[-0.04em] text-[var(--text-primary)] sm:text-3xl">
          {descriptor.traits.name}
        </h1>
      </div>

      <section aria-label="Ticket" className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-xs text-[var(--text-secondary)]">Ticket #{descriptor.input.ticketId.toString()}</p>
          <span className="rounded-full border border-[var(--border-strong)] px-2 py-1 text-xs text-[var(--text-primary)]"><PlanetTicketStatusLabel status={ticketStatus} /></span>
        </div>
        <div className="mt-3"><TicketCoordinates preview={preview} /></div>
        <div className="mt-3"><TicketLifecycle status={ticketStatus} onClaim={onClaim} pending={statusPending} /></div>
      </section>

      <section className="mt-4">
        <h2 className="font-hud text-lg font-bold text-[var(--text-primary)]">Details</h2>
        <dl className="mt-2 grid grid-cols-3 gap-x-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3">
          <Trait label="Terrain" value={humanize(descriptor.traits.terrain)} />
          <Trait label="Type" value={descriptor.traits.type} />
          <Trait label="Satellites" value={descriptor.traits.satelliteCount} />
          <Trait label="Clouds" value={preview.visual.traits.hasClouds ? 'Yes' : 'No'} dataTrait="clouds" />
          <Trait label="Base minerals" value={mining?.baseMineralsPerDay ?? 'Unavailable'} dataTrait="base-minerals" />
          <Trait label="Rarity" value={descriptor.traits.rarity} />
        </dl>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <ExplorerLink href={ticketExplorerUrl} label="Ticket BaseScan" />
        <ExplorerLink href={nftExplorerUrl} label="NFT BaseScan" />
      </div>
    </section>
  );
}
