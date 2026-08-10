import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import './TargetCursor.css';

type TargetCursorProps = {
  targetSelector?: string;
  spinDuration?: number;
  hideDefaultCursor?: boolean;
  hoverDuration?: number;
  parallaxOn?: boolean;
  cursorColor?: string;
  cursorColorOnTarget?: string;
};

type CursorCapabilities = { pointerCoarse: boolean; prefersReducedMotion: boolean };

export function shouldRenderTargetCursor({ pointerCoarse, prefersReducedMotion }: CursorCapabilities) {
  return !pointerCoarse && !prefersReducedMotion;
}

function getContainingBlock(element: HTMLElement | null) {
  let node = element?.parentElement ?? null;
  while (node && node !== document.documentElement) {
    const style = getComputedStyle(node);
    if (style.transform !== 'none' || style.perspective !== 'none' || style.filter !== 'none' || style.willChange.includes('transform') || style.willChange.includes('perspective') || style.willChange.includes('filter') || /paint|layout|strict|content/.test(style.contain)) return node;
    node = node.parentElement;
  }
  return null;
}

function getContainingBlockOffset(block: HTMLElement | null) {
  if (!block) return { x: 0, y: 0 };
  const rect = block.getBoundingClientRect();
  return { x: rect.left + block.clientLeft, y: rect.top + block.clientTop };
}

function readCapabilities(): CursorCapabilities {
  if (typeof window === 'undefined') return { pointerCoarse: true, prefersReducedMotion: true };
  return {
    pointerCoarse: window.matchMedia('(pointer: coarse)').matches,
    prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
}

export function TargetCursor({ targetSelector = '.cursor-target', spinDuration = 2, hideDefaultCursor = true, hoverDuration = 0.2, parallaxOn = true, cursorColor = '#F4F7FF', cursorColorOnTarget = '#B28CFF' }: TargetCursorProps) {
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const dotRef = useRef<HTMLDivElement | null>(null);
  const spinTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const [enabled, setEnabled] = useState(() => shouldRenderTargetCursor(readCapabilities()));

  useEffect(() => {
    const pointerQuery = window.matchMedia('(pointer: coarse)');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const refresh = () => setEnabled(shouldRenderTargetCursor({ pointerCoarse: pointerQuery.matches, prefersReducedMotion: motionQuery.matches }));
    pointerQuery.addEventListener('change', refresh);
    motionQuery.addEventListener('change', refresh);
    return () => {
      pointerQuery.removeEventListener('change', refresh);
      motionQuery.removeEventListener('change', refresh);
    };
  }, []);

  useEffect(() => {
    const cursor = cursorRef.current;
    if (!enabled || !cursor) return;

    const corners = Array.from(cursor.querySelectorAll<HTMLElement>('.target-cursor-corner'));
    const originalCursor = document.body.style.cursor;
    const containingBlock = getContainingBlock(cursor);
    const offset = () => getContainingBlockOffset(containingBlock);
    let activeTarget: Element | null = null;
    let removeLeaveListener: (() => void) | null = null;

    if (hideDefaultCursor) document.body.style.cursor = 'none';
    const initialOffset = offset();
    gsap.set(cursor, { xPercent: -50, yPercent: -50, x: window.innerWidth / 2 - initialOffset.x, y: window.innerHeight / 2 - initialOffset.y });
    spinTimelineRef.current = gsap.timeline({ repeat: -1 }).to(cursor, { rotation: '+=360', duration: spinDuration, ease: 'none' });

    const moveCursor = (event: MouseEvent) => {
      const currentOffset = offset();
      gsap.to(cursor, { x: event.clientX - currentOffset.x, y: event.clientY - currentOffset.y, duration: 0.1, ease: 'power3.out', overwrite: 'auto' });
    };
    const resetCorners = () => {
      const cornerSize = 12;
      const positions = [
        { x: -cornerSize * 1.5, y: -cornerSize * 1.5 },
        { x: cornerSize * 0.5, y: -cornerSize * 1.5 },
        { x: cornerSize * 0.5, y: cornerSize * 0.5 },
        { x: -cornerSize * 1.5, y: cornerSize * 0.5 },
      ];
      corners.forEach((corner, index) => {
        gsap.to(corner, { ...positions[index], duration: 0.3, ease: 'power3.out', overwrite: 'auto' });
      });
    };
    const leaveTarget = () => {
      activeTarget = null;
      removeLeaveListener?.();
      removeLeaveListener = null;
      resetCorners();
      gsap.to(corners, { borderColor: cursorColor, duration: 0.15, overwrite: 'auto' });
      if (dotRef.current) gsap.to(dotRef.current, { backgroundColor: cursorColor, duration: 0.15, overwrite: 'auto' });
      gsap.set(cursor, { rotation: 0 });
      spinTimelineRef.current?.restart();
    };
    const enterTarget = (event: MouseEvent) => {
      const candidate = event.target instanceof Element ? event.target.closest(targetSelector) : null;
      if (!candidate || candidate === activeTarget) return;
      if (activeTarget) leaveTarget();
      activeTarget = candidate;
      spinTimelineRef.current?.pause();
      gsap.to(corners, { borderColor: cursorColorOnTarget, duration: 0.15, overwrite: 'auto' });
      if (dotRef.current) gsap.to(dotRef.current, { backgroundColor: cursorColorOnTarget, duration: 0.15, overwrite: 'auto' });

      const rect = candidate.getBoundingClientRect();
      const currentOffset = offset();
      const cursorX = Number(gsap.getProperty(cursor, 'x'));
      const cursorY = Number(gsap.getProperty(cursor, 'y'));
      const positions = [
        { x: rect.left - 3 - currentOffset.x, y: rect.top - 3 - currentOffset.y },
        { x: rect.right - 3 - 12 - currentOffset.x, y: rect.top - 3 - currentOffset.y },
        { x: rect.right - 3 - 12 - currentOffset.x, y: rect.bottom - 3 - 12 - currentOffset.y },
        { x: rect.left - 3 - currentOffset.x, y: rect.bottom - 3 - 12 - currentOffset.y },
      ];
      corners.forEach((corner, index) => {
        gsap.to(corner, { x: positions[index].x - cursorX, y: positions[index].y - cursorY, duration: parallaxOn ? hoverDuration : 0, ease: 'power2.out', overwrite: 'auto' });
      });
      candidate.addEventListener('mouseleave', leaveTarget, { once: true });
      removeLeaveListener = () => candidate.removeEventListener('mouseleave', leaveTarget);
    };

    window.addEventListener('mousemove', moveCursor);
    window.addEventListener('mouseover', enterTarget, { passive: true });
    return () => {
      window.removeEventListener('mousemove', moveCursor);
      window.removeEventListener('mouseover', enterTarget);
      removeLeaveListener?.();
      spinTimelineRef.current?.kill();
      spinTimelineRef.current = null;
      document.body.style.cursor = originalCursor;
    };
  }, [cursorColor, cursorColorOnTarget, enabled, hideDefaultCursor, hoverDuration, parallaxOn, spinDuration, targetSelector]);

  if (!enabled) return null;
  return <div ref={cursorRef} className="target-cursor-wrapper" aria-hidden="true">
    <div ref={dotRef} className="target-cursor-dot" style={{ backgroundColor: cursorColor }} />
    <div className="target-cursor-corner corner-tl" style={{ borderColor: cursorColor }} />
    <div className="target-cursor-corner corner-tr" style={{ borderColor: cursorColor }} />
    <div className="target-cursor-corner corner-br" style={{ borderColor: cursorColor }} />
    <div className="target-cursor-corner corner-bl" style={{ borderColor: cursorColor }} />
  </div>;
}
