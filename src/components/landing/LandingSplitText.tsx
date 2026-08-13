import SplitText from './SplitText';

type LandingSplitTextProps = {
  text: string;
  className?: string;
  delay?: number;
  duration?: number;
  splitType?: 'chars' | 'words' | 'lines';
  tag?: string;
  from?: Record<string, unknown>;
  to?: Record<string, unknown>;
};

/**
 * Shared landing-page motion language. Product routes keep their own typography
 * and motion; this wrapper only standardizes the public landing copy.
 */
export function LandingSplitText({
  text,
  className = '',
  delay = 34,
  duration = 0.72,
  splitType = 'words',
  tag = 'span',
  from = { opacity: 0, y: 22, filter: 'blur(5px)' },
  to = { opacity: 1, y: 0, filter: 'blur(0px)' },
}: LandingSplitTextProps) {
  return (
    <SplitText
      tag={tag}
      text={text}
      className={`landing-split-animated ${className}`.trim()}
      delay={delay}
      duration={duration}
      ease="power3.out"
      splitType={splitType}
      from={from}
      to={to}
      threshold={0.08}
      rootMargin="-8%"
    />
  );
}
