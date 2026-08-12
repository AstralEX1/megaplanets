import type { ReactNode } from 'react';
import { Button } from '@/components/common/Button';
import { ExpeditionSteps, type ExpeditionStep } from '@/components/expedition/ExpeditionSteps';
import { UnrevealedPlanetVisual } from '@/components/planets/UnrevealedPlanetVisual';

const FEATURED_TICKET_COUNT = 3;

function PluralPlanets({ count }: { count: number }) {
  return (
    <>
      {count} {count === 1 ? 'planet' : 'planets'}
    </>
  );
}

export function ExpeditionStatusScreen({
  step,
  eyebrow,
  title,
  description,
  progress,
  action,
}: {
  step: ExpeditionStep;
  eyebrow: string;
  title: string;
  description: string;
  progress?: string;
  action?: ReactNode;
}) {
  return (
    <section className="mx-auto flex min-h-[min(680px,calc(100vh-8rem))] max-w-5xl flex-col items-center justify-center px-4 py-14 text-center">
      <ExpeditionSteps active={step} />
      <div className="mt-14 grid h-28 w-28 place-items-center rounded-full border border-[var(--primary)]/50 bg-[var(--surface-raised)] shadow-[0_0_55px_rgba(120,92,255,0.22)]">
        <span className="expedition-pulse text-4xl" aria-hidden="true">
          ✦
        </span>
      </div>
      <p className="mt-8 telemetry font-bold text-[var(--success)]">{eyebrow}</p>
      <h1 className="mt-3 max-w-2xl text-balance font-hud text-4xl font-bold tracking-[-0.05em] text-[var(--text-primary)] sm:text-5xl">
        {title}
      </h1>
      <p className="mt-4 max-w-xl text-pretty text-sm leading-6 text-[var(--text-secondary)] sm:text-base">
        {description}
      </p>
      {progress ? (
        <p className="mt-6 font-hud text-2xl font-bold text-[var(--text-primary)]">{progress}</p>
      ) : null}
      {action ? <div className="mt-8 w-full max-w-[310px] [&>button]:w-full">{action}</div> : null}
    </section>
  );
}

export function ExpeditionCompleteScreen({
  count,
  revealAction,
}: {
  count: number;
  revealAction: ReactNode;
}) {
  const featuredTickets = Math.min(count, FEATURED_TICKET_COUNT);
  return (
    <section className="mx-auto flex min-h-[590px] max-w-5xl flex-col items-center px-4 py-16 text-center sm:px-6 sm:py-20">
      <ExpeditionSteps active="reveal" />
      <p className="mt-12 telemetry font-bold text-[var(--success)]">EXPEDITION COMPLETE</p>
      <h1 className="mt-3 text-balance font-hud text-4xl font-bold tracking-[-0.05em] text-[var(--text-primary)] sm:text-[44px]">
        You found <PluralPlanets count={count} />!
      </h1>
      <div className="mt-12 flex h-[220px] items-center justify-center pt-4">
        {Array.from({ length: featuredTickets }, (_, index) => ({
          id: `mystery-${index + 1}`,
          index,
        })).map(({ id, index }) => (
          <div
            key={id}
            className={`h-[158px] w-[158px] shrink-0 overflow-hidden rounded-full border-2 border-[var(--rare)] bg-[var(--surface-raised)] shadow-[0_0_0_8px_var(--background)] sm:h-[210px] sm:w-[210px] ${index === 0 ? '' : '-ml-10 sm:-ml-[54px]'}`}
          >
            <UnrevealedPlanetVisual
              className="h-full w-full scale-[1.03]"
              label={`Unrevealed ticket ${index + 1}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-8 w-full max-w-[310px] [&>div>button]:w-full [&>button]:w-full">
        {revealAction}
      </div>
    </section>
  );
}

export function RevealCompleteScreen({
  cards,
  drawingId,
  onExploreAgain,
  onViewPlanets,
}: {
  cards: ReactNode;
  drawingId: bigint | undefined;
  onExploreAgain: () => void;
  onViewPlanets: () => void;
}) {
  return (
    <section className="mx-auto flex min-h-[590px] max-w-5xl flex-col items-center px-4 py-14 text-center sm:px-6 sm:py-16">
      <ExpeditionSteps active="reveal" />
      <p className="mt-10 telemetry font-bold text-[var(--success)]">REVEAL COMPLETE</p>
      <h1 className="mt-3 text-balance font-hud text-4xl font-bold tracking-[-0.05em] text-[var(--text-primary)]">
        Your new planets are ready.
      </h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        Drawing #{drawingId?.toString() ?? '—'}
      </p>
      <div className="mt-9 w-full">{cards}</div>
      <div className="mt-8 flex w-full max-w-[660px] flex-col gap-3 sm:flex-row">
        <Button variant="primary" size="lg" onClick={onExploreAgain} className="flex-1">
          Explore again
        </Button>
        <Button variant="secondary" size="lg" onClick={onViewPlanets} className="flex-1">
          View in My Planets
        </Button>
      </div>
    </section>
  );
}
