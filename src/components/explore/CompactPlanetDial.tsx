import Slider from '@mui/material/Slider';
import { useEffect, useRef, useState } from 'react';
import { clampExpeditionQuantity } from '@/lib/expeditionFlow';

const MIN = 1;
const MAX = 50;
const MARKERS = [1, 5, 10, 25, 50] as const;
const MARKS = MARKERS.map((value) => ({ value, label: String(value) }));

/** Quantity is controlled by Play; this component keeps slider and manual entry in sync. */
export function CompactPlanetDial({
  quantity,
  onChange,
}: {
  quantity: number;
  onChange: (value: number) => void;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const customInputRef = useRef<HTMLInputElement>(null);
  const safeQuantity = clampExpeditionQuantity(quantity);

  useEffect(() => {
    if (customOpen) customInputRef.current?.focus();
  }, [customOpen]);

  const applyCustomValue = () => {
    if (customValue.trim() !== '') onChange(clampExpeditionQuantity(Number(customValue)));
    setCustomOpen(false);
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        <span className="telemetry text-[var(--text-secondary)]">Planets to explore</span>
        <div className="flex items-center gap-3">
          {customOpen ? (
            <input
              ref={customInputRef}
              aria-label="Custom planet count"
              placeholder={String(safeQuantity)}
              className="h-10 w-20 rounded-lg border border-[var(--rare)] bg-[var(--surface-raised)] px-2 text-right font-hud text-sm font-bold tabular-nums text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)] focus:ring-2 focus:ring-[var(--rare)]"
              type="number"
              min={MIN}
              max={MAX}
              inputMode="numeric"
              value={customValue}
              onChange={(event) => setCustomValue(event.target.value)}
              onBlur={applyCustomValue}
              onKeyDown={(event) => {
                if (event.key === 'Enter') applyCustomValue();
              }}
            />
          ) : (
            <>
              <output className="font-hud text-lg font-bold tabular-nums text-[var(--text-primary)]">
                {safeQuantity}
              </output>
              <button
                type="button"
                aria-label="Custom quantity"
                onClick={() => {
                  setCustomValue('');
                  setCustomOpen(true);
                }}
                className="min-h-10 min-w-10 rounded-md border border-[var(--border-strong)] px-2 py-1 telemetry font-bold text-[var(--text-primary)] transition-[scale,border-color,color] duration-150 ease-out active:scale-[0.96] hover:border-[var(--rare)] hover:text-[var(--rare)]"
              >
                Custom
              </button>
            </>
          )}
        </div>
      </div>
      <Slider
        aria-label="Planets to explore"
        aria-valuetext={`${safeQuantity} planets`}
        value={safeQuantity}
        min={MIN}
        max={MAX}
        step={1}
        marks={MARKS}
        valueLabelDisplay="auto"
        getAriaValueText={(value) => `${value} planets`}
        onChange={(_, value) => {
          if (typeof value === 'number') onChange(clampExpeditionQuantity(value));
        }}
        sx={{
          mt: 1.5,
          px: 0.5,
          color: 'var(--rare)',
          '& .MuiSlider-rail': {
            height: 6,
            opacity: 1,
            borderRadius: 999,
            backgroundColor: 'var(--border)',
          },
          '& .MuiSlider-track': {
            height: 6,
            border: 'none',
            borderRadius: 999,
            backgroundColor: 'var(--rare)',
          },
          '& .MuiSlider-thumb': {
            width: 22,
            height: 22,
            backgroundColor: 'var(--rare)',
            border: '3px solid var(--text-primary)',
            boxShadow: '0 0 0 4px var(--background)',
            '&:hover, &.Mui-focusVisible': {
              boxShadow: '0 0 0 6px rgba(174, 185, 255, 0.24)',
            },
            '&.Mui-active': {
              boxShadow: '0 0 0 8px rgba(174, 185, 255, 0.24)',
            },
          },
          '& .MuiSlider-mark': {
            width: 4,
            height: 4,
            borderRadius: 0,
            backgroundColor: 'var(--text-primary)',
          },
          '& .MuiSlider-markLabel': {
            top: 32,
            color: 'var(--text-secondary)',
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: '0.875rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
          },
          '& .MuiSlider-input': {
            '&:focus-visible + .MuiSlider-thumb': {
              boxShadow: '0 0 0 6px rgba(174, 185, 255, 0.24)',
            },
          },
        }}
      />
    </div>
  );
}
