// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { SplitText as GSAPSplitText } from 'gsap/SplitText';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './SplitText.css';

gsap.registerPlugin(GSAPSplitText, useGSAP);
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  gsap.registerPlugin(ScrollTrigger);
}

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

const SplitText = ({
  text,
  className = '',
  delay = 50,
  duration = 1.25,
  ease = 'power3.out',
  splitType = 'chars',
  from = { opacity: 0, y: 40 },
  to = { opacity: 1, y: 0 },
  threshold = 0.1,
  rootMargin = '-100px',
  textAlign,
  tag = 'p',
  onLetterAnimationComplete,
}: {
  text: string;
  className?: string;
  delay?: number;
  duration?: number;
  ease?: string;
  splitType?: string;
  from?: Record<string, unknown>;
  to?: Record<string, unknown>;
  threshold?: number;
  rootMargin?: string;
  textAlign?: string;
  tag?: string;
  onLetterAnimationComplete?: () => void;
}) => {
  const ref = useRef(null);
  const animationCompletedRef = useRef(false);
  const onCompleteRef = useRef(onLetterAnimationComplete);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    onCompleteRef.current = onLetterAnimationComplete;
  }, [onLetterAnimationComplete]);

  useEffect(() => {
    if (reducedMotion || typeof document === 'undefined') {
      setFontsLoaded(true);
      return undefined;
    }

    const fonts = document.fonts;
    if (!fonts || fonts.status === 'loaded') {
      setFontsLoaded(true);
      return undefined;
    }

    let active = true;
    fonts.ready.then(() => {
      if (active) setFontsLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [reducedMotion]);

  useGSAP(
    () => {
      if (
        !ref.current ||
        !text ||
        !fontsLoaded ||
        reducedMotion ||
        animationCompletedRef.current ||
        (typeof window !== 'undefined' && typeof window.matchMedia !== 'function')
      ) return;
      const element = ref.current;
      let splitInstance = null;

      try {
        const startPercent = (1 - threshold) * 100;
        const marginMatch = /^(-?\d+(?:\.\d+)?)(px|em|rem|%)?$/.exec(rootMargin);
        const marginValue = marginMatch ? Number.parseFloat(marginMatch[1]) : 0;
        const marginUnit = marginMatch ? marginMatch[2] || 'px' : 'px';
        const sign =
          marginValue === 0
            ? ''
            : marginValue < 0
              ? `-=${Math.abs(marginValue)}${marginUnit}`
              : `+=${marginValue}${marginUnit}`;
        const start = `top ${startPercent}%${sign}`;
        let targets = null;

        splitInstance = new GSAPSplitText(element, {
          type: splitType,
          smartWrap: true,
          autoSplit: splitType === 'lines',
          linesClass: 'split-line',
          wordsClass: 'split-word',
          charsClass: 'split-char',
          reduceWhiteSpace: false,
          onSplit: (instance) => {
            if (splitType.includes('chars') && instance.chars.length) targets = instance.chars;
            if (!targets && splitType.includes('words') && instance.words.length) targets = instance.words;
            if (!targets && splitType.includes('lines') && instance.lines.length) targets = instance.lines;
            if (!targets) targets = instance.chars || instance.words || instance.lines;

            return gsap.fromTo(
              targets,
              { ...from },
              {
                ...to,
                duration,
                ease,
                stagger: delay / 1000,
                scrollTrigger: {
                  trigger: element,
                  start,
                  once: true,
                  fastScrollEnd: true,
                  anticipatePin: 0.4,
                },
                onComplete: () => {
                  animationCompletedRef.current = true;
                  onCompleteRef.current?.();
                },
                willChange: 'transform, opacity',
                force3D: true,
              },
            );
          },
        });
        element._rbsplitInstance = splitInstance;
      } catch {
        animationCompletedRef.current = true;
      }

      return () => {
        if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
          ScrollTrigger.getAll().forEach((trigger) => {
            if (trigger.trigger === element) trigger.kill();
          });
        }
        try {
          splitInstance?.revert();
        } catch {
          // The component may already be gone during route changes.
        }
        element._rbsplitInstance = null;
      };
    },
    {
      dependencies: [
        text,
        delay,
        duration,
        ease,
        splitType,
        JSON.stringify(from),
        JSON.stringify(to),
        threshold,
        rootMargin,
        fontsLoaded,
        reducedMotion,
      ],
      scope: ref,
    },
  );

  const Tag = tag || 'p';
  const classes = `split-parent ${className}`.trim();
  const style = {
    ...(textAlign ? { textAlign } : {}),
    overflow: 'hidden',
    display: 'block',
    whiteSpace: 'normal',
    wordWrap: 'break-word',
    willChange: reducedMotion ? 'auto' : 'transform, opacity',
  };

  return (
    <Tag ref={ref} style={style} className={classes}>
      {text}
    </Tag>
  );
};

export default SplitText;
