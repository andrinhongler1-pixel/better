import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { OutlineButton } from '../../../src/components/OutlineButton';
import { Label, Secondary, ToolPage, ui } from '../../../src/components/ToolPage';
import { useQuit } from '../../../src/features/quit/QuitProvider';
import { ClockNotice, DataBoundary, Streak } from '../../../src/features/quit/components';
import { dayText, statistics } from '../../../src/features/quit/model';
import { useClock } from '../../../src/features/quit/useClock';

export default function QuitList() { return <DataBoundary><Timers /></DataBoundary>; }
function Timers() {
  const { data } = useQuit();
  const now = useClock();
  const router = useRouter();
  return <ToolPage title="QUIT">
    {data.timers.length === 0 && <View style={styles.empty}><Label>A FRESH START</Label><Text style={styles.emptyTitle}>Make room for better.</Text><Secondary>Choose one thing to leave behind.{'\n'}Your time starts when you do.</Secondary></View>}
    {data.timers.map(timer => {
      const stats = statistics(timer, now);
      return <View key={timer.id} style={styles.timer}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${timer.title}`} onPress={() => router.push(`/quit/${timer.id}`)} style={({ pressed }) => [styles.hit, { opacity: pressed ? 0.6 : 1 }]}>
          <Text style={ui.title}>{timer.title.toUpperCase()}</Text>
          <Streak duration={stats.current} />
          <View style={styles.best}><Label>BEST</Label><Text style={[ui.numeric, styles.bestValue]}>{dayText(stats.best)}</Text></View>
        </Pressable>
        <ClockNotice behind={stats.clockBehind} />
      </View>;
    })}
    <View style={styles.action}><OutlineButton label="+ NEW TIMER" onPress={() => router.push('/quit/new')} /></View>
    <Text style={[ui.secondary, styles.footnote]}>Stay with the next moment.</Text>
  </ToolPage>;
}
const styles = StyleSheet.create({
  timer: { backgroundColor: '#141414', borderRadius: 20, borderWidth: 1, borderColor: '#292929', padding: 22, marginBottom: 16 }, hit: { gap: 22, borderRadius: 16 },
  best: { flexDirection: 'row', alignItems: 'baseline', gap: 20 }, bestValue: { fontSize: 12 },
  action: { marginTop: 'auto', paddingTop: 24 }, footnote: { fontSize: 11, textAlign: 'center', marginTop: 20 },
  empty: { flex: 1, justifyContent: 'center', minHeight: 260, gap: 20, padding: 24, backgroundColor: '#141414', borderRadius: 20, borderWidth: 1, borderColor: '#292929' },
  emptyTitle: { color: '#FFFFFF', fontSize: 27, fontWeight: '600', letterSpacing: -0.7 },
});
