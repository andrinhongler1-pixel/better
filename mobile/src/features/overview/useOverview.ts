import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildOverview, overviewKeys } from './model';
import type { HistoryKind } from './model';
export function useOverview() {
  const [state, setState] = useState(() => ({ ...buildOverview({}, Date.now()), loading: true })); const generation = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++generation.current; const kinds = Object.keys(overviewKeys) as HistoryKind[];
    const values = await Promise.allSettled(kinds.map(kind => AsyncStorage.getItem(overviewKeys[kind])));
    const raw = Object.fromEntries(kinds.map((kind, i) => [kind, values[i]?.status === 'fulfilled' ? values[i].value : '{unreadable']));
    if (current === generation.current) setState({ ...buildOverview(raw, Date.now()), loading: false });
  }, []);
  useFocusEffect(useCallback(() => { void refresh(); return () => { ++generation.current; }; }, [refresh]));
  return { ...state, refresh };
}
