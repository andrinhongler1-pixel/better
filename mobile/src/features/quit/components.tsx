import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { OutlineButton } from '../../components/OutlineButton';
import { Label, Secondary, ToolPage, ui } from '../../components/ToolPage';
import { useQuit } from './QuitProvider';
import { clockText, dayText, durationParts } from './model';

export function Streak({ duration, dominant = false }: { duration: number; dominant?: boolean }) {
  return <View style={styles.streak}>
    {dominant ? <><Text style={[ui.numeric, styles.days]} adjustsFontSizeToFit numberOfLines={1}>{durationParts(duration).days}</Text><Label>DAYS</Label></> : <Text style={[ui.numeric, styles.dayLabel]}>{dayText(duration)}</Text>}
    <Text style={[ui.numeric, dominant ? styles.clockLarge : styles.clock]}>{clockText(duration)}</Text>
  </View>;
}
export function DataBoundary({ children }: { children: ReactNode }) {
  const { status, repository } = useQuit();
  if (status === 'loading') return <ToolPage title="QUIT"><Secondary>Loading your timers…</Secondary></ToolPage>;
  if (status === 'error') return <ToolPage title="QUIT"><Label>DATA UNAVAILABLE</Label><Secondary>Your timers could not be loaded. Existing data has been kept. Retry to continue.</Secondary><View style={ui.section}><OutlineButton label="RETRY" onPress={() => { void repository.load(); }} /></View></ToolPage>;
  return <>{children}</>;
}
export function useTimer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, repository } = useQuit();
  return { timer: data.timers.find(t => t.id === id), repository };
}
export function MissingTimer() {
  const router = useRouter();
  return <ToolPage title="TIMER NOT FOUND" back="/quit"><Secondary>This timer is no longer available.</Secondary><View style={ui.section}><OutlineButton label="BACK TO QUIT" onPress={() => router.replace('/quit')} /></View></ToolPage>;
}
export function ClockNotice({ behind }: { behind: boolean }) {
  return behind ? <Secondary>Your device clock is earlier than this streak’s start. Check your date and time settings. Elapsed time is held at zero.</Secondary> : null;
}
const styles = StyleSheet.create({
  streak: { gap: 10 }, days: { fontSize: 112, lineHeight: 124, letterSpacing: -6 },
  dayLabel: { fontSize: 36, letterSpacing: -1 }, clock: { fontSize: 23, letterSpacing: 2 }, clockLarge: { fontSize: 29, letterSpacing: 2, marginTop: 12 },
});
