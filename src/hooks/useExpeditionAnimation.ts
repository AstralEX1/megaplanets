import { useEffect, useState } from 'react';
import type { ExpeditionScene } from '@/lib/expeditionFlow';

/**
 * Presentation-only state. Scene changes are driven by chain-derived flow;
 * this hook never decides a result, ticket, trait, or reveal outcome.
 */
export function useExpeditionAnimation(scene: ExpeditionScene) {
  const [animationState, setAnimationState] = useState(() => ({ scene, enteredAt: Date.now() }));

  useEffect(() => {
    setAnimationState((current) =>
      current.scene === scene ? current : { scene, enteredAt: Date.now() },
    );
  }, [scene]);

  return {
    scene: animationState.scene,
    enteredAt: animationState.enteredAt,
    isScanning:
      animationState.scene !== 'configure' && animationState.scene !== 'signals-located',
  };
}
