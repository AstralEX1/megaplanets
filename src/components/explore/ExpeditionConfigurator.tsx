import { useState, type ReactNode } from 'react';
import { formatUnits } from 'viem';
import { ApprovalButton } from '@/components/common/ApprovalButton';
import { DepthText } from '@/components/common/DepthText';
import type { CustomTicket, TicketBounds } from '@/lib/tickets';
import { CompactPlanetDial } from './CompactPlanetDial';
import { CoordinatesPanel } from './CoordinatesDisclosure';
import { ExploreButton } from './ExploreButton';
import { StaticDepthStack } from './StaticDepthStack';

function formatJackpot(amount: bigint) {
  return Number(formatUnits(amount, 6)).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function ExpeditionConfigurator({
  quantity,
  total,
  jackpotAmount = 0n,
  bounds,
  manuallyEditedTickets,
  automaticQuickPick,
  disabled,
  exploreLabel,
  approvalSpender,
  approvalAmount,
  onApproved,
  onQuantityChange,
  onAutomaticQuickPickChange,
  onTicketsChange,
  onExplore,
}: {
  quantity: number;
  total: bigint;
  jackpotAmount?: bigint;
  bounds: TicketBounds | null;
  manuallyEditedTickets: readonly CustomTicket[];
  automaticQuickPick: boolean;
  disabled: boolean;
  exploreLabel?: ReactNode;
  approvalSpender?: `0x${string}`;
  approvalAmount?: bigint;
  onApproved?: () => void;
  onQuantityChange: (value: number) => void;
  onAutomaticQuickPickChange: (value: boolean) => void;
  onTicketsChange: (tickets: readonly CustomTicket[]) => void;
  onExplore: () => void;
}) {
  const [coordinatesOpen, setCoordinatesOpen] = useState(false);
  const coordinatesLabel = coordinatesOpen ? 'Close coordinates' : 'Open coordinates';

  return (
    <section className="relative mx-auto w-full px-4 py-0 sm:px-6">
      <div className="w-full">
        <div
          data-testid="expedition-core"
          data-layout-anchor="fixed"
          className="mx-auto w-full max-w-[840px]"
        >
          <div className="flex flex-col items-center">
            <h1 className="max-w-full text-center">
              <DepthText
                text={`Win up to $${formatJackpot(jackpotAmount)}`}
                faceColor="#f8fafc"
                depthColor="#7c3aed"
                layers={28}
                depth={1.5}
                tilt={10.5}
                smoothing={0.3}
                perspective={1_500}
                orbitSpeed={0.1}
                pointerTracking={false}
                autoOrbit
                fontSize="clamp(2rem, 4vw, 3.4rem)"
                fontWeight={950}
                shadow
              />
            </h1>
            <StaticDepthStack quantity={quantity} />
            <div className="w-full">
              <CompactPlanetDial quantity={quantity} onChange={onQuantityChange} />
            </div>
            <div className="w-full">
              {approvalSpender !== undefined && approvalAmount !== undefined ? (
                <ApprovalButton
                  spender={approvalSpender}
                  amount={approvalAmount}
                  onApproved={onApproved}
                >
                  <ExploreButton
                    quantity={quantity}
                    total={total}
                    disabled={disabled}
                    label={exploreLabel}
                    onClick={onExplore}
                  />
                </ApprovalButton>
              ) : (
                <ExploreButton
                  quantity={quantity}
                  total={total}
                  disabled={disabled}
                  label={exploreLabel}
                  onClick={onExplore}
                />
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          aria-label={coordinatesLabel}
          aria-expanded={coordinatesOpen}
          onClick={() => setCoordinatesOpen((open) => !open)}
          className={`absolute left-[calc(50%+420px)] top-1/2 z-10 hidden h-40 w-14 -translate-y-1/2 items-center justify-center bg-[var(--background)] text-4xl text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-raised)] xl:flex ${coordinatesOpen ? 'border-l border-[var(--border)]' : ''}`}
        >
          <span aria-hidden>{coordinatesOpen ? '‹' : '›'}</span>
        </button>
        <div
          data-testid="coordinates-disclosure"
          data-side="right"
          className={`absolute left-[calc(50%+476px)] top-0 hidden h-full w-[min(430px,calc(50vw-492px))] min-w-0 overflow-y-auto overflow-x-hidden transition-opacity duration-300 ease-out xl:block ${coordinatesOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        >
          {coordinatesOpen && (
            <CoordinatesPanel
              quantity={quantity}
              bounds={bounds}
              manuallyEditedTickets={manuallyEditedTickets}
              automaticQuickPick={automaticQuickPick}
              onAutomaticQuickPickChange={onAutomaticQuickPickChange}
              onTicketsChange={onTicketsChange}
            />
          )}
        </div>
      </div>
      <div className="mx-auto mt-5 w-full max-w-[560px] xl:hidden">
        <button
          type="button"
          aria-label={coordinatesLabel}
          aria-expanded={coordinatesOpen}
          onClick={() => setCoordinatesOpen((open) => !open)}
          className="flex min-h-12 w-full items-center justify-between border-t border-[var(--border)] pt-3 font-hud text-sm font-semibold uppercase tracking-[0.06em] text-[var(--text-primary)]"
        >
          <span>{coordinatesOpen ? '⌄ Hide coordinates' : '› Choose coordinates'}</span>
          <span className="text-xs normal-case tracking-normal text-[var(--text-secondary)]">
            Optional
          </span>
        </button>
        {coordinatesOpen && (
          <div className="mt-3 border border-[var(--border-strong)]">
            <CoordinatesPanel
              quantity={quantity}
              bounds={bounds}
              manuallyEditedTickets={manuallyEditedTickets}
              automaticQuickPick={automaticQuickPick}
              onAutomaticQuickPickChange={onAutomaticQuickPickChange}
              onTicketsChange={onTicketsChange}
            />
          </div>
        )}
      </div>
    </section>
  );
}
