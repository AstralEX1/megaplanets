// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import { Mesh, Program, Renderer, Triangle } from 'ogl';
import './Lightfall.css';

const MAX_COLORS = 8;

const hexToRGB = (hex) => {
  const value = hex.replace('#', '').padEnd(6, '0');
  return [
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255,
  ];
};

const prepColors = (input) => {
  const base = (input?.length ? input : ['#A6C8FF', '#5227FF', '#FF9FFC']).slice(0, MAX_COLORS);
  const count = base.length;
  const colors = Array.from({ length: MAX_COLORS }, (_, index) =>
    hexToRGB(base[Math.min(index, base.length - 1)]),
  );
  const average = [0, 0, 0];

  for (let index = 0; index < count; index += 1) {
    average[0] += colors[index][0];
    average[1] += colors[index][1];
    average[2] += colors[index][2];
  }

  return {
    colors,
    count,
    average: average.map((value) => value / count),
  };
};

const vertex = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `
precision highp float;

uniform vec3 iResolution;
uniform vec2 iMouse;
uniform float iTime;
uniform vec3 uColor0;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;
uniform vec3 uColor5;
uniform vec3 uColor6;
uniform vec3 uColor7;
uniform int uColorCount;
uniform vec3 uBgColor;
uniform vec3 uMouseColor;
uniform float uSpeed;
uniform int uStreakCount;
uniform float uStreakWidth;
uniform float uStreakLength;
uniform float uGlow;
uniform float uDensity;
uniform float uTwinkle;
uniform float uZoom;
uniform float uBgGlow;
uniform float uOpacity;
uniform float uMouseEnabled;
uniform float uMouseStrength;
uniform float uMouseRadius;

varying vec2 vUv;

vec3 palette(float hue) {
  int count = max(uColorCount, 1);
  int index = int(floor(clamp(hue, 0.0, 0.999999) * float(count)));
  if (index <= 0) return uColor0;
  if (index == 1) return uColor1;
  if (index == 2) return uColor2;
  if (index == 3) return uColor3;
  if (index == 4) return uColor4;
  if (index == 5) return uColor5;
  if (index == 6) return uColor6;
  return uColor7;
}

vec3 tanhv(vec3 value) {
  vec3 exponential = exp(-2.0 * value);
  return (1.0 - exponential) / (1.0 + exponential);
}

vec2 sceneC(vec2 frag, vec2 resolution) {
  vec2 point = (frag + frag - resolution) / resolution.x;
  float depth = 0.0;
  float distanceToScene = 1e3;
  vec4 outputValue = vec4(0.0);

  for (int index = 0; index < 39; index++) {
    if (distanceToScene <= 1e-4) break;
    outputValue = depth * normalize(vec4(point, uZoom, 0.0)) - vec4(0.0, 4.0, 1.0, 0.0) / 4.5;
    distanceToScene = 1.0 - sqrt(length(outputValue * outputValue));
    depth += distanceToScene;
  }

  return vec2(outputValue.x, atan(outputValue.z, outputValue.y));
}

void mainImage(out vec4 outputColor, vec2 coordinate) {
  vec2 resolution = iResolution.xy;
  vec2 uv = (coordinate + coordinate - resolution) / resolution.x;
  float time = 0.1 * iTime * uSpeed + 9.0;
  float ringCount = max(1.0, floor(6.28318530718 * max(uDensity, 0.05) + 0.5));
  vec2 cell = vec2(5e-3, 6.28318530718 / ringCount);
  vec2 scene = sceneC(coordinate, resolution);
  vec2 sceneDx = sceneC(coordinate + vec2(1.0, 0.0), resolution);
  vec2 sceneDy = sceneC(coordinate + vec2(0.0, 1.0), resolution);
  vec2 derivativeX = sceneDx - scene;
  vec2 derivativeY = sceneDy - scene;
  derivativeX.y -= 6.28318530718 * floor(derivativeX.y / 6.28318530718 + 0.5);
  derivativeY.y -= 6.28318530718 * floor(derivativeY.y / 6.28318530718 + 0.5);
  vec2 filterWidth = abs(derivativeX) + abs(derivativeY);
  vec2 current = scene;
  vec2 backgroundPoint = vec2(2.0, 1.0) * uv - (resolution / resolution.x) * vec2(0.0, 1.0);
  vec4 accumulated = vec4(uBgColor * 90.0 * uBgGlow / (1e3 * dot(backgroundPoint, backgroundPoint) + 6.0), 0.0);
  float mouseGlow = 0.0;

  if (uMouseEnabled > 0.5) {
    vec2 mouse = (iMouse + iMouse - resolution) / resolution.x;
    float mouseDistance = length(uv - mouse);
    mouseGlow = exp(-mouseDistance * mouseDistance / max(uMouseRadius * uMouseRadius, 1e-4)) * uMouseStrength;
    accumulated.rgb += uMouseColor * mouseGlow * 0.25;
  }

  float width = 5e-4 * uStreakWidth;
  vec2 pixelRadius = vec2(max(length(filterWidth), 1e-5));
  float tail = 19.0 / max(uStreakLength, 0.05);

  for (int streak = 0; streak < 16; streak++) {
    if (streak >= uStreakCount) break;
    float offset = float(streak) + 1.0;
    float randomValue = fract(sin(dot(vec2(offset, floor(current.x / cell.x + 0.5)), vec2(7.0, 11.0)) * 73.0));
    vec2 streakPoint = current - (time + time * randomValue) * vec2(0.0, 1.0);
    streakPoint -= floor(streakPoint / cell + 0.5) * cell;
    float hue = fract(8663.0 * randomValue);
    vec3 color = palette(hue);
    float weight = mix(1.5, 1.0 + sin(time + 7.0 * hue + 4.0), uTwinkle);
    weight *= 1.0 + mouseGlow * 2.0;
    vec2 inner = vec2(length(max(streakPoint, vec2(-1.0, 0.0))), length(streakPoint) - width) - width;
    vec2 smooth = vec2(1.0) - smoothstep(-pixelRadius, pixelRadius, inner);
    accumulated.rgb += dot(smooth, vec2(exp(tail * streakPoint.y), 3.0)) * color * weight;
    current.x += cell.x / 8.0;
  }

  vec3 toneMapped = sqrt(tanhv(max(accumulated.rgb * uGlow - vec3(0.04, 0.08, 0.02), 0.0)));
  outputColor = vec4(toneMapped, uOpacity);
}

void main() {
  vec4 color;
  mainImage(color, vUv * iResolution.xy);
  gl_FragColor = color;
}
`;

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener?.('change', update);
    return () => mediaQuery.removeEventListener?.('change', update);
  }, []);

  return reducedMotion;
}

const Lightfall = ({
  className = '',
  dpr,
  paused = false,
  colors = ['#A6C8FF', '#5227FF', '#FF9FFC'],
  backgroundColor = '#0A29FF',
  speed = 0.5,
  streakCount = 2,
  streakWidth = 1,
  streakLength = 1,
  glow = 1,
  density = 0.6,
  twinkle = 1,
  zoom = 3,
  backgroundGlow = 0.5,
  opacity = 1,
  mouseInteraction = true,
  mouseStrength = 0.5,
  mouseRadius = 1,
  mouseDampening = 0.15,
  mixBlendMode,
}) => {
  const containerRef = useRef(null);
  const rafRef = useRef(null);
  const programRef = useRef(null);
  const meshRef = useRef(null);
  const geometryRef = useRef(null);
  const rendererRef = useRef(null);
  const mouseTargetRef = useRef([0, 0]);
  const lastTimeRef = useRef(0);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const container = containerRef.current;
    if (!container || reducedMotion || typeof window === 'undefined') return undefined;
    if (!window.WebGLRenderingContext && !window.WebGL2RenderingContext) return undefined;

    let renderer = null;
    try {
      renderer = new Renderer({
        dpr: dpr ?? window.devicePixelRatio ?? 1,
        alpha: true,
        // This is a full-screen shader pass; MSAA adds work without improving the image.
        antialias: false,
      });
    } catch {
      return undefined;
    }

    rendererRef.current = renderer;
    const gl = renderer.gl;
    const canvas = gl.canvas;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    container.appendChild(canvas);

    const { colors: preparedColors, count, average } = prepColors(colors);
    const uniforms = {
      iResolution: { value: [gl.drawingBufferWidth, gl.drawingBufferHeight, 1] },
      iMouse: { value: [0, 0] },
      iTime: { value: 0 },
      uColor0: { value: preparedColors[0] },
      uColor1: { value: preparedColors[1] },
      uColor2: { value: preparedColors[2] },
      uColor3: { value: preparedColors[3] },
      uColor4: { value: preparedColors[4] },
      uColor5: { value: preparedColors[5] },
      uColor6: { value: preparedColors[6] },
      uColor7: { value: preparedColors[7] },
      uColorCount: { value: count },
      uBgColor: { value: hexToRGB(backgroundColor) },
      uMouseColor: { value: average },
      uSpeed: { value: speed },
      uStreakCount: { value: Math.max(1, Math.min(16, Math.round(streakCount))) },
      uStreakWidth: { value: streakWidth },
      uStreakLength: { value: streakLength },
      uGlow: { value: glow },
      uDensity: { value: density },
      uTwinkle: { value: twinkle },
      uZoom: { value: zoom },
      uBgGlow: { value: backgroundGlow },
      uOpacity: { value: opacity },
      uMouseEnabled: { value: mouseInteraction ? 1 : 0 },
      uMouseStrength: { value: mouseStrength },
      uMouseRadius: { value: mouseRadius },
    };

    let program = null;
    let geometry = null;
    let mesh = null;
    try {
      program = new Program(gl, { vertex, fragment, uniforms });
      geometry = new Triangle(gl);
      mesh = new Mesh(gl, { geometry, program });
    } catch {
      if (canvas.parentElement === container) container.removeChild(canvas);
      renderer.destroy?.();
      rendererRef.current = null;
      return undefined;
    }

    programRef.current = program;
    geometryRef.current = geometry;
    meshRef.current = mesh;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height);
      uniforms.iResolution.value = [gl.drawingBufferWidth, gl.drawingBufferHeight, 1];
    };
    resize();

    let resizeObserver = null;
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', resize);
    } else {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
    }

    const onPointerMove = (event) => {
      const rect = canvas.getBoundingClientRect();
      const scale = renderer.dpr || 1;
      const x = (event.clientX - rect.left) * scale;
      const y = (rect.height - (event.clientY - rect.top)) * scale;
      mouseTargetRef.current = [x, y];
      if (mouseDampening <= 0) uniforms.iMouse.value = [x, y];
    };

    if (mouseInteraction) canvas.addEventListener('pointermove', onPointerMove);

    let lastRenderTime = -Infinity;
    const minRenderIntervalMs = 1_000 / 30;
    const loop = (time) => {
      rafRef.current = requestAnimationFrame(loop);
      uniforms.iTime.value = time * 0.001;
      if (mouseDampening > 0) {
        if (!lastTimeRef.current) lastTimeRef.current = time;
        const delta = (time - lastTimeRef.current) / 1000;
        lastTimeRef.current = time;
        const factor = Math.min(1, 1 - Math.exp(-delta / Math.max(1e-4, mouseDampening)));
        const target = mouseTargetRef.current;
        const current = uniforms.iMouse.value;
        current[0] += (target[0] - current[0]) * factor;
        current[1] += (target[1] - current[1]) * factor;
      } else {
        lastTimeRef.current = time;
      }

      if (
        !paused &&
        time - lastRenderTime >= minRenderIntervalMs &&
        programRef.current &&
        meshRef.current
      ) {
        lastRenderTime = time;
        renderer.render({ scene: meshRef.current });
      }
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (mouseInteraction) canvas.removeEventListener('pointermove', onPointerMove);
      if (resizeObserver) resizeObserver.disconnect();
      else window.removeEventListener('resize', resize);
      if (canvas.parentElement === container) container.removeChild(canvas);
      programRef.current?.remove?.();
      geometryRef.current?.remove?.();
      meshRef.current?.remove?.();
      rendererRef.current?.destroy?.();
      programRef.current = null;
      geometryRef.current = null;
      meshRef.current = null;
      rendererRef.current = null;
    };
  }, [
    backgroundColor,
    backgroundGlow,
    colors,
    density,
    dpr,
    glow,
    mouseDampening,
    mouseInteraction,
    mouseRadius,
    mouseStrength,
    opacity,
    paused,
    reducedMotion,
    speed,
    streakCount,
    streakLength,
    streakWidth,
    twinkle,
    zoom,
  ]);

  return (
    <div
      ref={containerRef}
      className={`lightfall-container ${className ?? ''}`.trim()}
      style={mixBlendMode ? { mixBlendMode } : undefined}
    />
  );
};

export default Lightfall;
