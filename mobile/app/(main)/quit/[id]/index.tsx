import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { OutlineButton } from '../../../../src/components/OutlineButton';
import { Label, Secondary, ToolPage, ui } from '../../../../src/components/ToolPage';
import { ClockNotice, DataBoundary, MissingTimer, Streak, useTimer } from '../../../../src/features/quit/components';
import { dateText, dayText, durationParts, pad, statistics } from '../../../../src/features/quit/model';
import { useClock } from '../../../../src/features/quit/useClock';

export default function TimerDetailScreen() { return <DataBoundary><TimerDetail /></DataBoundary>; }
function TimerDetail() {
  const { timer } = useTimer();
  const now = useClock();
  const router = useRouter();
  if (!timer) return <MissingTimer />;
  const stats = statistics(timer, now);
  return <ToolPage title={timer.title.toUpperCase()} back="/quit">
    <Label>CURRENT</Label>
    <View style={styles.current}><Streak duration={stats.current} dominant /></View>
    <ClockNotice behind={stats.clockBehind} />
    <View style={ui.section}><Label>STARTED</Label><Text style={styles.date}>{dateText(timer.currentStartAt)}</Text></View>
    <Text style={styles.caption}>Times follow your device clock.</Text>
    <View style={ui.divider} />
    <View style={styles.metrics}>
      <View style={styles.metric}><Label>BEST</Label><Text style={styles.value}>{dayText(stats.best)}</Text></View>
      <View style={styles.metric}><Label>ATTEMPTS</Label><Text style={styles.value}>{stats.attempts}</Text></View>
      <View style={styles.metric}><Label>TOTAL</Label><Text style={styles.value}>{dayText(stats.total)}</Text></View>
    </View>
    <Text style={styles.caption}>Total includes the current streak.</Text>
    <View style={ui.divider} />
    <OutlineButton label="I FAILED" onPress={() => router.push(`/quit/${timer.id}/reset`)} />
    <View style={styles.history}><Label>HISTORY</Label><View style={ui.divider} />
      {!timer.history.length && <Secondary>No completed attempts.{'\n'}This is your first start.</Secondary>}
      {[...timer.history].reverse().map((attempt, index) => <Pressable key={attempt.id} accessibilityRole="button" accessibilityLabel={`View attempt ${timer.history.length - index}`} onPress={() => router.push(`/quit/${timer.id}/attempt/${attempt.id}`)} style={({ pressed }) => [styles.attempt, { opacity: pressed ? 0.6 : 1 }]}>
        <Text style={ui.small}>ATTEMPT {pad(timer.history.length - index)}</Text>
        <Text style={[ui.numeric, { fontSize: 20 }]}>{dayText(attempt.duration)} {pad(durationParts(attempt.duration).hours)} HOURS</Text>
        {attempt.reason && <Label>{attempt.reason}</Label>}
        {attempt.note && <Secondary>Private note saved</Secondary>}
      </Pressable>)}
    </View>
    <Pressable accessibilityRole="button" onPress={() => router.push(`/quit/${timer.id}/delete`)} style={styles.delete}><Text style={ui.label}>DELETE TIMER</Text></Pressable>
  </ToolPage>;
}
const styles = StyleSheet.create({
  current: { padding: 22, backgroundColor: '#141414', borderRadius: 20, borderWidth: 1, borderColor: '#292929', marginTop: 12 }, date: { color: '#FFFFFF', fontSize: 13, fontVariant: ['tabular-nums'], lineHeight: 22 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, metric: { flexGrow: 1, gap: 12, minWidth: 120, padding: 18, backgroundColor: '#141414', borderRadius: 20, borderWidth: 1, borderColor: '#292929' },
  value: { color: '#FFFFFF', fontSize: 22, fontWeight: '500', fontVariant: ['tabular-nums'] },
  caption: { color: '#8A8A8A', fontSize: 11, marginTop: 20 }, history: { marginTop: 48 },
  attempt: { gap: 12, borderWidth: 1, borderColor: '#292929', borderRadius: 20, backgroundColor: '#141414', padding: 22, marginBottom: 12 },
  delete: { minHeight: 48, alignSelf: 'flex-start', justifyContent: 'center', marginTop: 32, borderRadius: 999, backgroundColor: '#141414', paddingHorizontal: 20 },
});
