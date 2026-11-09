import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { SleepRepository, SLEEP_KEY } from './repository';
import { sleepExclusive } from './exclusive';
const Context = createContext<{ repository: SleepRepository; restingId: string | null; ritualEpoch: number; startSleep: (revision: number) => Promise<void> } | null>(null);
export function SleepProvider({ children }: { children: ReactNode }) {
  const [repository] = useState(() => new SleepRepository(AsyncStorage, sleepExclusive));
  const [restingId, setRestingId] = useState<string | null>(null);
  const [ritualEpoch, setRitualEpoch] = useState(0);
  useEffect(() => {
    const load = () => { void repository.load(); };
    load();
    const sub = AppState.addEventListener('change', state => { if (state !== 'active') setRestingId(null); else { setRitualEpoch(n => n + 1); load(); } });
    const storage = (event: StorageEvent) => { if (event.key === SLEEP_KEY || event.key === null) load(); };
    if (Platform.OS === 'web') { window.addEventListener('storage', storage); window.addEventListener('pageshow', load); }
    return () => { sub.remove(); if (Platform.OS === 'web') { window.removeEventListener('storage', storage); window.removeEventListener('pageshow', load); } };
  }, [repository]);
  const startSleep = async (revision: number) => { const active = await repository.start(revision); setRestingId(active.id); };
  return <Context.Provider value={{ repository, restingId, ritualEpoch, startSleep }}>{children}</Context.Provider>;
}
export function useSleep() {
  const context = useContext(Context); if (!context) throw new Error('SleepProvider is missing.');
  return { ...context, ...useSyncExternalStore(context.repository.subscribe, context.repository.getSnapshot, context.repository.getSnapshot) };
}
