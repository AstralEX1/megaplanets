const STEPS = ['Configure', 'Explore', 'Discover', 'Reveal'] as const;

export type ExpeditionStep = 'configure' | 'explore' | 'discover' | 'reveal';

export function ExpeditionSteps({ active }: { active: ExpeditionStep }) {
  const activeIndex = ({ configure: 0, explore: 1, discover: 2, reveal: 3 } as const)[active];
  return (
    <ol className="flex items-center justify-between gap-1 px-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)] sm:justify-center sm:gap-4 sm:text-xs">
      {STEPS.map((step, index) => (
        <li key={step} className="flex shrink-0 items-center gap-2">
          <span className={index === activeIndex ? 'text-[var(--primary)]' : index < activeIndex ? 'text-[var(--text)]' : undefined}>
            {String(index + 1).padStart(2, '0')} <span className="hidden sm:inline">{step}</span>
          </span>
          {index < STEPS.length - 1 && <span className="h-px w-3 bg-[var(--border)] sm:w-10" />}
        </li>
      ))}
    </ol>
  );
}
