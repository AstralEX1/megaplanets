import { animate, type MotionValue, motion, useMotionValue, useTransform } from 'motion/react';
import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import './OrbitImages.css';

type OrbitShape =
  | 'ellipse'
  | 'circle'
  | 'square'
  | 'rectangle'
  | 'triangle'
  | 'star'
  | 'heart'
  | 'infinity'
  | 'wave'
  | 'custom';
type OrbitImagesProps = {
  images: readonly string[];
  altPrefix?: string;
  shape?: OrbitShape;
  customPath?: string;
  baseWidth?: number;
  radiusX?: number;
  radiusY?: number;
  radius?: number;
  starPoints?: number;
  starInnerRatio?: number;
  rotation?: number;
  duration?: number;
  itemSize?: number;
  direction?: 'normal' | 'reverse';
  fill?: boolean;
  width?: number | '100%';
  height?: number | 'auto';
  className?: string;
  itemClassName?: string;
  centerContent?: ReactNode;
  responsive?: boolean;
};

function ellipsePath(cx: number, cy: number, rx: number, ry: number) {
  return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy}`;
}

function shapePath(
  shape: OrbitShape,
  cx: number,
  cy: number,
  radiusX: number,
  radiusY: number,
  radius: number,
  customPath?: string,
) {
  if (shape === 'circle') return ellipsePath(cx, cy, radius, radius);
  if (shape === 'rectangle')
    return `M ${cx - radiusX} ${cy - radiusY} L ${cx + radiusX} ${cy - radiusY} L ${cx + radiusX} ${cy + radiusY} L ${cx - radiusX} ${cy + radiusY} Z`;
  if (shape === 'square')
    return `M ${cx - radius} ${cy - radius} L ${cx + radius} ${cy - radius} L ${cx + radius} ${cy + radius} L ${cx - radius} ${cy + radius} Z`;
  if (shape === 'custom') return customPath ?? ellipsePath(cx, cy, radiusX, radiusY);
  return ellipsePath(cx, cy, radiusX, radiusY);
}

function OrbitItem({
  src,
  index,
  total,
  path,
  itemSize,
  rotation,
  progress,
  fill,
  altPrefix,
  itemClassName,
}: {
  src: string;
  index: number;
  total: number;
  path: string;
  itemSize: number;
  rotation: number;
  progress: MotionValue<number>;
  fill: boolean;
  altPrefix: string;
  itemClassName: string;
}) {
  const offset = useTransform(
    progress,
    (value) =>
      `${((((value + (fill ? (index / total) * 100 : 0)) % 100) + 100) % 100).toFixed(3)}%`,
  );
  return (
    <motion.div
      className={`orbit-item ${itemClassName}`.trim()}
      style={{
        width: itemSize,
        height: itemSize,
        offsetPath: `path("${path}")`,
        offsetRotate: '0deg',
        offsetAnchor: 'center center',
        offsetDistance: offset,
      }}
    >
      <div style={{ transform: `rotate(${-rotation}deg)` }}>
        <img
          src={src}
          alt={`${altPrefix} ${index + 1}`}
          draggable={false}
          className="orbit-image"
        />
      </div>
    </motion.div>
  );
}

export function OrbitImages({
  images,
  altPrefix = 'Orbiting planet',
  shape = 'ellipse',
  customPath,
  baseWidth = 1400,
  radiusX = 340,
  radiusY = 100,
  radius = 300,
  rotation = -16,
  duration = 35,
  itemSize = 88,
  direction = 'normal',
  fill = true,
  width = '100%',
  height = 'auto',
  className = '',
  itemClassName = '',
  centerContent,
  responsive = true,
}: OrbitImagesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);
  const progress = useMotionValue(0);
  const path = useMemo(
    () => shapePath(shape, baseWidth / 2, baseWidth / 2, radiusX, radiusY, radius, customPath),
    [baseWidth, customPath, radius, radiusX, radiusY, shape],
  );

  useLayoutEffect(() => {
    if (!responsive || !containerRef.current) return;
    const update = () => setScale((containerRef.current?.clientWidth ?? baseWidth) / baseWidth);
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [baseWidth, responsive]);

  useEffect(() => {
    const controls = animate(progress, direction === 'reverse' ? -100 : 100, {
      duration,
      ease: 'linear',
      repeat: Infinity,
      repeatType: 'loop',
    });
    return () => controls.stop();
  }, [direction, duration, progress]);

  if (images.length === 0) return null;
  const orbitItems = images.reduce<{ src: string; key: string }[]>((items, src) => {
    const occurrence = items.filter((item) => item.src === src).length + 1;
    items.push({ src, key: `${src}-${occurrence}` });
    return items;
  }, []);
  const singleItemPath = ellipsePath(baseWidth / 2, baseWidth / 2, 42, 24);
  return (
    <div
      ref={containerRef}
      data-testid="planet-orbit"
      className={`orbit-container ${className}`.trim()}
      style={{ width, height, aspectRatio: responsive ? '1 / 1' : undefined }}
    >
      <div
        className="orbit-scaling-container"
        style={{
          width: responsive ? baseWidth : '100%',
          height: responsive ? baseWidth : '100%',
          transform:
            responsive && scale !== null ? `translate(-50%, -50%) scale(${scale})` : undefined,
          visibility: responsive && scale === null ? 'hidden' : undefined,
        }}
      >
        <div className="orbit-rotation-wrapper" style={{ transform: `rotate(${rotation}deg)` }}>
          {orbitItems.map((item, index) => (
            <OrbitItem
              key={item.key}
              src={item.src}
              index={index}
              total={orbitItems.length}
              path={orbitItems.length === 1 ? singleItemPath : path}
              itemSize={itemSize}
              rotation={rotation}
              progress={progress}
              fill={fill}
              altPrefix={altPrefix}
              itemClassName={itemClassName}
            />
          ))}
        </div>
      </div>
      {centerContent ? <div className="orbit-center-content">{centerContent}</div> : null}
    </div>
  );
}
