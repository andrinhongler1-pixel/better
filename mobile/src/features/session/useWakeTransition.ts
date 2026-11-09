import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, Platform } from 'react-native';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const nativeDriver = Platform.OS !== 'web';
export function useWakeTransition(onComplete: (reducedMotion: boolean) => void) {
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  const headingY = useRef(new Animated.Value(0)).current;
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const locked = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const [busy, setBusy] = useState(false);
  const [highlighted, setHighlighted] = useState(false);

  const reset = useCallback(() => {
    animation.current?.stop();
    opacity.setValue(1);
    headingY.setValue(0);
    locked.current = false;
    setBusy(false);
    setHighlighted(false);
  }, [opacity, headingY]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') reset();
    });
    return () => { animation.current?.stop(); subscription.remove(); };
  }, [reset]);

  const start = useCallback(() => {
    // The ref locks synchronously, including taps before React commits disabled.
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setHighlighted(!reduced);

    const fadeOut = () => {
      setHighlighted(false);
      animation.current = Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: reduced ? 120 : 250, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }),
        ...(reduced ? [] : [Animated.timing(headingY, { toValue: -12, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver })]),
      ]);
      animation.current.start(({ finished }) => {
        if (!finished) return;
        const navigate = () => onCompleteRef.current(reduced);
        if (reduced) { navigate(); return; }
        animation.current = Animated.delay(100);
        animation.current.start(({ finished: pauseFinished }) => { if (pauseFinished) navigate(); });
      });
    };

    if (reduced) { fadeOut(); return; }
    animation.current = Animated.delay(100);
    animation.current.start(({ finished }) => { if (finished) fadeOut(); });
  }, [reduced, opacity, headingY]);

  return { start, opacity, headingY, busy, highlighted };
}
