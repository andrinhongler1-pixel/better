import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { PlannerRepository, PLANNER_KEY } from './repository';
import { plannerExclusive } from './exclusive';
const Context = createContext<PlannerRepository | null>(null);
export function PlannerProvider({ children }: { children: ReactNode }) {
  const [repository] = useState(() => new PlannerRepository(AsyncStorage, plannerExclusive));
  useEffect(() => { const load = () => { void repository.load(); }; load(); const sub = AppState.addEventListener('change', state => { if (state === 'active') load(); }); const onStorage = (event: StorageEvent) => { if (event.key === PLANNER_KEY || event.key === null) load(); }; if (Platform.OS === 'web') { window.addEventListener('storage', onStorage); window.addEventListener('pageshow', load); } return () => { sub.remove(); if (Platform.OS === 'web') { window.removeEventListener('storage', onStorage); window.removeEventListener('pageshow', load); } }; }, [repository]);
  return <Context.Provider value={repository}>{children}</Context.Provider>;
}
export function usePlanner() { const repository = useContext(Context); if (!repository) throw new Error('PlannerProvider is missing.'); return { repository, ...useSyncExternalStore(repository.subscribe, repository.getSnapshot, repository.getSnapshot) }; }
