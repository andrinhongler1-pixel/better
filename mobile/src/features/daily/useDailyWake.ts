import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { hasWokenToday, localDay } from './calendar';

/** The ritual belongs to this opening, never to persisted completion data. */
export function useDailyWake() {
  const [wakeDay, setWakeDay] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        setWakeDay(null);
        refresh();
      }
    });
    const timer = setInterval(refresh, 1000);
    return () => { subscription.remove(); clearInterval(timer); };
  }, []);
  const wake = useCallback(() => {
    const date = new Date();
    setWakeDay(localDay(date));
    setNow(date);
  }, []);
  return { awake: hasWokenToday(wakeDay, now), now, wake };
}
