import type { CSSProperties } from 'react';
import mineIcon from '@/assets/mine-icon.png';
import mineralIcon from '@/assets/mineral-icon.png';
import type { PlanetMiningSnapshot } from '@/hooks/useWalletMining';
import { LiveMineralAmount } from './LiveMineralAmount';

type PlanetMiningOverlayProps = {
  mining?: PlanetMiningSnapshot;
  miningAsOf?: string;
};

function MaskIcon({ src, label }: { src: string; label: string }) {
  const style = {
    WebkitMaskImage: `url(${src})`,
    maskImage: `url(${src})`,
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
  } as CSSProperties;
  return <span role="img" aria-label={label} className="h-7 w-7 shrink-0 bg-[var(--rare)]" style={style} />;
}

export function PlanetMiningOverlay({ mining, miningAsOf }: PlanetMiningOverlayProps) {
  if (!mining || !miningAsOf) {
    return (
      <div data-testid="planet-mining-overlay" className="absolute inset-x-3 bottom-3 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)]/90 p-3 text-center backdrop-blur-md">
        <span className="telemetry text-[var(--text-secondary)]">Mining unavailable</span>
      </div>
    );
  }

  return (
    <div data-testid="planet-mining-overlay" className="absolute inset-x-3 bottom-3 grid grid-cols-2 overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)]/90 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-2 border-r border-[var(--border)] p-3">
        <img src={mineralIcon} alt="Minerals" className="h-7 w-7 shrink-0 object-contain invert" />
        <span className="min-w-0">
          <strong className="block font-hud text-lg text-[var(--text-primary)]">{mining.baseMineralsPerDay}</strong>
          <span className="telemetry block text-[var(--text-secondary)]">MINERALS / DAY</span>
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-2 p-3">
        <MaskIcon src={mineIcon} label="Mined" />
        <span className="min-w-0">
          <LiveMineralAmount
            prefix="Mined"
            snapshotMicros={mining.earnedMicros}
            effectiveMineralsPerDayMicros={mining.effectiveMineralsPerDayMicros}
            asOf={miningAsOf}
            className="block font-hud text-lg text-[var(--text-primary)]"
          />
          <span className="telemetry block text-[var(--text-secondary)]">MINED</span>
        </span>
      </div>
    </div>
  );
}
