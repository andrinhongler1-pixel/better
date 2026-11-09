import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Prefer the quieter option until the asynchronous platform preference is known. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let alive = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      changed = true;
      if (alive) setReduced(value);
    });
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (alive && !changed) setReduced(value);
    }).catch(() => {});
    return () => { alive = false; subscription.remove(); };
  }, []);
  return reduced;
}
