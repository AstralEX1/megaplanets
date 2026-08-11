import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import './DepthText.css';

const MAX_LAYERS = 64;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getLayerColor(faceColor: string, depthColor: string, index: number, total: number) {
  const progress = total <= 1 ? 1 : index / total;
  const eased = progress * progress;
  const faceMix = Math.round((1 - eased) * 72 + 4);
  return `color-mix(in srgb, ${faceColor} ${faceMix}%, ${depthColor})`;
}

function getTransform(rotateX: number, rotateY: number) {
  return `rotateX(${rotateX.toFixed(3)}deg) rotateY(${rotateY.toFixed(3)}deg)`;
}

type DepthTextProps = {
  text: string;
  layers?: number;
  depth?: number;
  faceColor?: string;
  depthColor?: string;
  tilt?: number;
  pointerTracking?: boolean;
  smoothing?: number;
  perspective?: number;
  autoOrbit?: boolean;
  orbitSpeed?: number;
  fontSize?: string;
  fontWeight?: number;
  shadow?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function DepthText({
  text,
  layers = 20,
  depth = 1.4,
  faceColor = 'var(--text-primary)',
  depthColor = 'var(--rare)',
  tilt = 6,
  pointerTracking = true,
  smoothing = 0.14,
  perspective = 900,
  autoOrbit = true,
  orbitSpeed = 0.08,
  fontSize = 'clamp(2rem, 4vw, 3.4rem)',
  fontWeight = 900,
  shadow = true,
  className = '',
  style = {},
}: DepthTextProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const stageRef = useRef<HTMLSpanElement>(null);
  const safeLayers = clamp(Math.round(Number(layers) || 1), 2, MAX_LAYERS);
  const safeDepth = clamp(Number(depth) || 0, 0, 12);
  const safeTilt = clamp(Number(tilt) || 0, 0, 12);
  const safeSmoothing = clamp(Number(smoothing) || 0.14, 0.02, 0.35);
  const safePerspective = clamp(Number(perspective) || 900, 300, 2_000);
  const safeOrbitSpeed = clamp(Number(orbitSpeed) || 0, 0, 2);
  const baseRotation = useMemo(
    () => ({ x: -safeTilt * 0.32, y: safeTilt * 0.42 }),
    [safeTilt],
  );
  const depthLayers = useMemo(
    () => Array.from({ length: safeLayers }, (_, layerIndex) => {
      const index = safeLayers - layerIndex;
      return {
        index,
        color: getLayerColor(faceColor, depthColor, index, safeLayers),
        transform: `translateZ(${-index * safeDepth}px)`,
      };
    }),
    [depthColor, faceColor, safeDepth, safeLayers],
  );

  useEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    if (!root || !stage) return;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const finePointer = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? false;
    const canTrackPointer = pointerTracking && finePointer && !reducedMotion;
    if (reducedMotion || (!canTrackPointer && !autoOrbit)) {
      stage.style.transform = getTransform(baseRotation.x, baseRotation.y);
      return;
    }

    let frameId = 0;
    let activePointer = false;
    const startTime = performance.now();
    const current = { ...baseRotation };
    const target = { ...baseRotation };
    const handlePointerMove = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      activePointer = true;
      const x = clamp((event.clientX - (rect.left + rect.width / 2)) / (rect.width * 0.8), -1, 1);
      const y = clamp((event.clientY - (rect.top + rect.height / 2)) / (rect.height * 0.8), -1, 1);
      target.x = baseRotation.x - y * safeTilt;
      target.y = baseRotation.y + x * safeTilt;
    };
    const handlePointerLeave = () => {
      activePointer = false;
      target.x = baseRotation.x;
      target.y = baseRotation.y;
    };
    if (canTrackPointer) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerleave', handlePointerLeave);
      window.addEventListener('blur', handlePointerLeave);
    }
    const tick = (now: number) => {
      if ((!canTrackPointer || !activePointer) && autoOrbit) {
        const orbit = ((now - startTime) / 1_000) * safeOrbitSpeed * Math.PI * 2;
        const amount = canTrackPointer ? 0.18 : 0.55;
        target.x = baseRotation.x + Math.sin(orbit) * safeTilt * amount;
        target.y = baseRotation.y + Math.cos(orbit * 0.85) * safeTilt * amount;
      }
      current.x += (target.x - current.x) * safeSmoothing;
      current.y += (target.y - current.y) * safeSmoothing;
      stage.style.transform = getTransform(current.x, current.y);
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => {
      if (canTrackPointer) {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerleave', handlePointerLeave);
        window.removeEventListener('blur', handlePointerLeave);
      }
      cancelAnimationFrame(frameId);
    };
  }, [autoOrbit, baseRotation, pointerTracking, safeOrbitSpeed, safeSmoothing, safeTilt]);

  const rootStyle = {
    ...style,
    '--depth-text-perspective': `${safePerspective}px`,
    '--depth-text-font-size': fontSize,
    '--depth-text-font-weight': fontWeight,
    '--depth-text-face-color': faceColor,
    '--depth-text-shadow': shadow
      ? `0 18px 30px color-mix(in srgb, ${depthColor} 30%, transparent), 0 4px 8px rgba(0, 0, 0, 0.28)`
      : 'none',
  } as CSSProperties;

  return (
    <span ref={rootRef} className={`depth-text ${className}`.trim()} style={rootStyle}>
      <span ref={stageRef} className="depth-text__stage">
        {depthLayers.map((layer) => (
          <span aria-hidden="true" className="depth-text__layer" key={layer.index} style={{ color: layer.color, transform: layer.transform }}>
            {text}
          </span>
        ))}
        <span className="depth-text__face">{text}</span>
      </span>
    </span>
  );
}
