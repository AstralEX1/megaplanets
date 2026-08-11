import { useEffect, useState } from 'react';
import { formatMinerals, interpolateMinerals } from '@/lib/minerals';

type LiveMineralAmountProps = {
  snapshotMicros: string;
  effectiveMineralsPerDayMicros: string;
  asOf: string;
  prefix?: string;
  className?: string;
};

export function LiveMineralAmount({
  snapshotMicros,
  effectiveMineralsPerDayMicros,
  asOf,
  prefix,
  className,
}: LiveMineralAmountProps) {
  const [now, setNow] = useState(() => new Date(asOf));

  useEffect(() => {
    setNow(new Date(asOf));
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const interval = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(interval);
  }, [asOf]);

  const amount = interpolateMinerals({
    snapshotMicros: BigInt(snapshotMicros),
    effectiveMineralsPerDayMicros: BigInt(effectiveMineralsPerDayMicros),
    asOf: new Date(asOf),
    now,
  });
  const label = `${prefix ? `${prefix} ` : ''}${formatMinerals(amount)}`;
  return <span className={className}>{label}</span>;
}
