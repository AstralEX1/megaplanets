import type { ReactNode } from 'react';
import type { PlanetPreview } from '@megaplanets/planet-generator';
import { Button } from '@/components/common/Button';
import { PlanetThumbnail } from '@/components/planets/PlanetThumbnail';

const FEATURED_TICKET_COUNT = 3;

function PluralPlanets({ count }: { count: number }) {
  return <>{count} {count === 1 ? 'planet' : 'planets'}</>;
}

export function ExpeditionCompleteScreen({ count, revealAction }: { count: number; revealAction: ReactNode }) {
  const featuredTickets = Math.min(count, FEATURED_TICKET_COUNT);
  const tickets = Array.from({ length: featuredTickets }, (_, index) => ({ id: `ticket-${index + 1}`, index }));

  return (
    <section className="mx-auto flex min-h-[590px] max-w-5xl flex-col items-center px-4 py-16 text-center sm:px-6 sm:py-24">
      <p className="telemetry font-bold text-[var(--success)]">EXPEDITION COMPLETE</p>
      <h1 className="mt-3 font-hud text-4xl font-bold tracking-[-0.05em] text-[var(--text-primary)] sm:text-[44px]">You found <PluralPlanets count={count} />!</h1>
      <div className="mt-12 flex h-[220px] items-center justify-center pt-4">
        {tickets.map(({ id, index }) => <div key={id} role="img" aria-label={`Unrevealed ticket ${index + 1}`} className={`grid h-[158px] w-[158px] shrink-0 place-items-center rounded-full border-2 border-[var(--rare)] bg-[var(--surface-raised)] text-6xl font-hud font-semibold text-[var(--text-primary)] shadow-[0_0_0_8px_var(--background)] sm:h-[210px] sm:w-[210px] sm:text-[74px] ${index === 0 ? '' : '-ml-10 sm:-ml-[54px]'}`}>?</div>)}
      </div>
      <div className="mt-10 w-full max-w-[310px] [&>button]:w-full">{revealAction}</div>
    </section>
  );
}

export function RevealCompleteScreen({ planets, drawingId, onViewPlanets }: { planets: readonly PlanetPreview[]; drawingId: bigint | undefined; onViewPlanets: () => void }) {
  return (
    <section className="mx-auto flex min-h-[590px] max-w-5xl flex-col items-center px-4 py-14 text-center sm:px-6 sm:py-16">
      <p className="telemetry font-bold text-[var(--success)]">REVEAL COMPLETE</p>
      <h1 className="mt-3 font-hud text-4xl font-bold tracking-[-0.05em] text-[var(--text-primary)]">Your new planets are ready.</h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">Drawing #{drawingId?.toString() ?? '—'} · Season 01</p>
      <div className="mt-9 grid w-full grid-cols-1 gap-4 text-left sm:grid-cols-2 lg:grid-cols-3">
        {planets.map((preview) => <article key={preview.descriptor.input.ticketId.toString()} className="rounded-[18px] border border-[var(--border-strong)] bg-[var(--surface-raised)] p-4 shadow-[0_18px_42px_rgba(0,0,0,0.2)]">
          <div role="img" aria-label={`Revealed planet ${preview.descriptor.traits.name}`} className="mx-auto grid aspect-square w-full max-w-[160px] place-items-center overflow-hidden bg-[var(--surface)]"><PlanetThumbnail descriptor={preview.visual} /></div>
          <div className="mt-5 flex items-end justify-between gap-3"><div><h2 className="font-hud text-xl font-bold text-[var(--text-primary)]">{preview.descriptor.traits.name}</h2><p className="mt-1 telemetry text-[var(--rare)]">#{preview.descriptor.input.ticketId.toString()} · {preview.descriptor.traits.type}</p></div><span className="telemetry shrink-0 text-[var(--text-secondary)]">⌁ {preview.descriptor.traits.minerals}</span></div>
          <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3"><span className="telemetry text-[var(--text-secondary)]">{preview.descriptor.traits.rarity}</span><button type="button" disabled title="Planet claims are not available yet." className="rounded-md border border-[var(--warning)] px-2.5 py-1.5 telemetry font-bold text-[var(--warning)] disabled:cursor-not-allowed disabled:opacity-90">Claim</button></div>
        </article>)}
      </div>
      <Button variant="primary" size="lg" onClick={onViewPlanets} className="mt-8 w-full max-w-[310px]">My planets</Button>
    </section>
  );
}
