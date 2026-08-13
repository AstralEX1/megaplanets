import { formatUnits } from 'viem';
import { Countdown } from '@/components/lottery/Countdown';
import { DepthText } from '@/components/common/DepthText';
import { useJackpotState } from '@/hooks/useJackpotState';
import { LandingSplitText } from './LandingSplitText';

function formatJackpot(amount: bigint | undefined) {
  if (amount === undefined) return '$—';
  return `$${Number(formatUnits(amount, 6)).toLocaleString('en-US', {
    maximumFractionDigits: 2,
  })}`;
}

export function LandingLiveJackpot() {
  const { state, drawingId, phase } = useJackpotState();
  const drawingLabel = phase === 'open' ? 'DRAWING IN' : 'DRAWING LIVE';
  const phaseLabel = phase === 'open' ? 'TICKETS OPEN' : 'SETTLEMENT ACTIVE';

  return (
    <aside className="landing-live-jackpot" aria-label="Live jackpot and drawing countdown">
      <div className="landing-live-jackpot-layout" data-testid="landing-jackpot-layout">
        <div className="landing-live-jackpot-main">
          <div className="landing-live-jackpot-header">
            <LandingSplitText tag="span" className="landing-kicker" text="LIVE JACKPOT" />
            <LandingSplitText
              tag="span"
              className="landing-live-jackpot-status"
              text={phaseLabel}
              delay={28}
              duration={0.58}
            />
          </div>
          <div className="landing-live-jackpot-echo" data-testid="landing-jackpot-echo">
            <DepthText
              text={formatJackpot(state?.prizePool)}
              faceColor="var(--landing-dust)"
              depthColor="var(--landing-mineral)"
              layers={64}
              depth={2.35}
              tilt={8}
              smoothing={0.24}
              perspective={1_800}
              orbitSpeed={0.06}
              pointerTracking
              autoOrbit
              fontSize="clamp(4.2rem, 11.5vw, 10rem)"
              fontWeight={1_000}
              shadow
              className="landing-live-jackpot-depth"
            />
          </div>
        </div>
        <div className="landing-live-jackpot-footer landing-live-jackpot-drawing-panel" data-testid="landing-drawing-in">
          <div>
            <LandingSplitText tag="span" className="landing-micro-label" text={drawingLabel} delay={30} duration={0.58} />
            <Countdown drawingTimeUnix={state?.drawingTime} />
          </div>
          <LandingSplitText
            tag="span"
            className="landing-live-jackpot-drawing"
            text={`DRAWING #${drawingId?.toString() ?? '—'}`}
            delay={28}
            duration={0.58}
          />
        </div>
      </div>
    </aside>
  );
}
