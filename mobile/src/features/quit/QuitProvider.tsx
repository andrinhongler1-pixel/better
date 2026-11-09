import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { QuitRepository } from './repository';

const Context = createContext<QuitRepository | null>(null);
export function QuitProvider({ children }: { children: ReactNode }) {
  const [repository] = useState(() => new QuitRepository(AsyncStorage));
  useEffect(() => { void repository.load(); }, [repository]);
  return <Context.Provider value={repository}>{children}</Context.Provider>;
}
export function useQuit() {
  const repository = useContext(Context);
  if (!repository) throw new Error('QuitProvider is missing.');
  const snapshot = useSyncExternalStore(repository.subscribe, repository.getSnapshot, repository.getSnapshot);
  return { ...snapshot, repository };
}
export function useQuitAction() {
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (operation: () => Promise<unknown>, onSuccess: () => void) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try { await operation(); if (mounted.current) onSuccess(); }
    catch (e) { if (mounted.current) setError(e instanceof Error && /already changed|no longer exists|title|note|start time/.test(e.message) ? e.message : 'Could not save your change. Please try again.'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  return { busy, error, run };
}
