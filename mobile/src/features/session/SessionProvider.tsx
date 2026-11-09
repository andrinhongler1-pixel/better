import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';

interface TodayEntrance { id: number; reducedMotion: boolean }
interface Session {
  unlocked: boolean;
  lock: () => void;
  todayEntrance: TodayEntrance | null;
  unlock: (reducedMotion: boolean) => void;
  finishTodayEntrance: (id: number) => void;
}
const Context = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [todayEntrance, setTodayEntrance] = useState<TodayEntrance | null>(null);
  const nextEntrance = useRef(0);
  const lock = useCallback(() => { setUnlocked(false); setTodayEntrance(null); }, []);
  const unlock = useCallback((reducedMotion: boolean) => {
    setTodayEntrance({ id: ++nextEntrance.current, reducedMotion });
    setUnlocked(true);
  }, []);
  const finishTodayEntrance = useCallback((id: number) => {
    setTodayEntrance(current => current?.id === id ? null : current);
  }, []);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') { setUnlocked(false); setTodayEntrance(null); }
    });
    return () => sub.remove();
  }, []);
  return <Context.Provider value={{ unlocked, lock, unlock, todayEntrance, finishTodayEntrance }}>{children}</Context.Provider>;
}
export function useSession() {
  const context = useContext(Context);
  if (!context) throw new Error('SessionProvider is missing.');
  return context;
}
