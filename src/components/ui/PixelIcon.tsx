export type PixelIconName = 'add' | 'subtract' | 'alert' | 'signal';

/** Small local SVG subset adapted to the 24px grid used by Pixelarticons. */
export function PixelIcon({ name, className = '' }: { name: PixelIconName; className?: string }) {
  const shapes = {
    add: <><path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z" /></>,
    subtract: <path d="M4 10h16v4H4z" />,
    alert: <><path d="M10 3h4l7 14-3 4H6l-3-4zm2 5v6h-1V8zm0 8v2h-1v-2z" /></>,
    signal: <><path d="M10 3h4v4h-4zm-4 6h12v4H6zm-3 6h18v4H3z" /></>,
  }[name];
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={`inline-block fill-current [shape-rendering:crispEdges] ${className}`}>{shapes}</svg>;
}
