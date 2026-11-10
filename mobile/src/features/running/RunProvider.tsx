import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { RunRepository, RUNNING_KEY } from './repository';
import { RunRecorder } from './recorder';
import { gpsDriver } from './driver';
import { runExclusive } from './exclusive';
const Context = createContext<{ repository: RunRepository; recorder: RunRecorder } | null>(null);
export function RunProvider({ children }: { children: ReactNode }) {
  const [repository] = useState(() => new RunRepository(AsyncStorage, runExclusive));
  const [recorder] = useState(() => new RunRecorder(repository, gpsDriver));
  useEffect(() => {
    const load = () => { void repository.load(); }; load();
    const sub = AppState.addEventListener('change', state => { if (state !== 'active') void recorder.pause('App left the foreground. Resume explicitly; unrecorded gaps are excluded.'); else load(); });
    const storage = (e: StorageEvent) => { if (e.key === RUNNING_KEY || e.key === null) load(); };
    const hidden = () => { if (document.visibilityState === 'hidden') void recorder.pause('App or screen was hidden. Resume explicitly; the gap is excluded.'); };
    const leaving = () => { void recorder.pause('Page closed. Last saved checkpoint retained.'); };
    const timer = setInterval(() => { void recorder.tick(); }, 5000);
    if (Platform.OS === 'web') { window.addEventListener('storage', storage); window.addEventListener('pagehide', leaving); document.addEventListener('visibilitychange', hidden); }
    return () => { sub.remove(); clearInterval(timer); void recorder.pause('Recording screen closed.'); if (Platform.OS === 'web') { window.removeEventListener('storage', storage); window.removeEventListener('pagehide', leaving); document.removeEventListener('visibilitychange', hidden); } };
  }, [repository, recorder]);
  return <Context.Provider value={{ repository, recorder }}>{children}</Context.Provider>;
}
export function useRunning() { const c = useContext(Context); if (!c) throw new Error('RunProvider is missing.'); return { ...c, ...useSyncExternalStore(c.repository.subscribe, c.repository.getSnapshot, c.repository.getSnapshot), recording: useSyncExternalStore(c.recorder.subscribe, c.recorder.getSnapshot, c.recorder.getSnapshot) }; }
