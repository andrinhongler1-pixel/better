import { useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

/** Repaints the focused screen; elapsed durations always come from timestamps. */
export function useClock() {
  const [now, setNow] = useState(Date.now);
  useFocusEffect(useCallback(() => {
    const refresh = () => setNow(Date.now());
    refresh();
    const timer = setInterval(refresh, 1000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []));
  return now;
}
