import { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { OutlineButton } from '../../components/OutlineButton';
import { ErrorMessage, Label, Secondary, ui } from '../../components/ToolPage';
import { useSleep } from './SleepProvider';
import { useSession } from '../session/SessionProvider';
import { useWakeTransition } from '../session/useWakeTransition';
import { clockLabel, dateLabel, durationLabel, offsetLabel, parseTimestamp, timestampFields } from './model';
import type { SleepSession } from './model';
import { TimeFields } from './TimeFields';
import type { TimeValue } from './TimeFields';
import { Disclosure } from '../../components/Disclosure';

export function SleepRitual() {
  const { data, status, repository, restingId, ritualEpoch, startSleep } = useSleep();
  const { unlock } = useSession(); const router = useRouter();
  const [summary, setSummary] = useState<SleepSession | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const lock = useRef(false);
  const [correction, setCorrection] = useState<{ value: TimeValue; revision: number; id: string } | null>(null);
  const [cancel, setCancel] = useState(false);
  useEffect(() => { setSummary(null); setCorrection(null); setCancel(false); setError(null); }, [ritualEpoch]);
  useEffect(() => { if (data.active) setSummary(null); }, [data.active?.id]);
  const { width, height } = useWindowDimensions();
  const titleSize = Math.min(120, Math.max(56, (Math.min(width, 520) - 56) / 3.15), height * .15);
  async function run(action: () => Promise<void>) { if (lock.current) return; lock.current = true; setBusy(true); setError(null); try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Please try again.'); } finally { lock.current = false; setBusy(false); } }
  const enter = (reduced: boolean) => { unlock(reduced); router.replace('/today'); };
  // Only the entrance transition navigates. Waking itself first saves exact timestamps.
  const transition = useWakeTransition(enter);
  const active = data.active;
  const resting = active && active.id === restingId;
  const disabled = busy || transition.busy;
  const title = summary ? 'GOOD\nMORNING.' : active ? resting ? 'REST\nWELL.' : 'WAKE\nUP' : 'SLEEP.';
  return <SafeAreaView style={styles.safe}><ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}><Animated.View style={[styles.shell, { opacity: transition.opacity }]}>
    <View style={styles.header}><Text style={ui.brand}>better.</Text><Label>A DAILY RITUAL</Label></View>
    <View style={styles.main}>
      <Label>{summary ? 'A NEW BEGINNING' : active ? 'SLEEPING' : 'AWAKE'}</Label>
      <Animated.Text accessibilityRole="header" style={[styles.title, { fontSize: summary ? titleSize * .7 : titleSize, lineHeight: titleSize * (summary ? .7 : .95), transform: [{ translateY: transition.headingY }] }]}>{title}</Animated.Text>
      {status === 'loading' ? <Secondary>Opening your sleep journal.</Secondary> : status === 'error' ? <><ErrorMessage message="Sleep data could not be loaded. Existing records have not been overwritten. Use an updated Safari and retry." /><OutlineButton label="RETRY SLEEP DATA" onPress={() => { void repository.load(); }} /><OutlineButton label="CONTINUE TO APP" onPress={() => enter(true)} /></> : summary ? <>
        <View style={ui.card}><Label>YOU SLEPT</Label><Text style={styles.duration}>{durationLabel(summary.duration)}</Text><View style={ui.row}><View><Label>SLEEP START</Label><Text style={ui.title}>{clockLabel(summary.sleepStart)}</Text><Secondary>{dateLabel(summary.sleepStart)}</Secondary><Label>UTC {offsetLabel(summary.sleepStart)}</Label></View><View><Label>WAKE UP</Label><Text style={ui.title}>{clockLabel(summary.wakeAt)}</Text><Secondary>{dateLabel(summary.wakeAt)}</Secondary><Label>UTC {offsetLabel(summary.wakeAt)}</Label></View></View></View>
        <Secondary>Time between your button presses, not medically verified sleep. You can correct it in SLEEP.</Secondary>
        <OutlineButton label="START YOUR DAY" disabled={disabled} highlighted={transition.highlighted} onPress={transition.start} />
      </> : active ? <>
        <Secondary>{resting ? 'Put the day down. Your start time is saved; you can close the app.' : 'Ready for a new day? Save your wake time when you are up.'}</Secondary>
        <View style={ui.card}><Label>SLEEP START</Label><Text style={ui.title}>{clockLabel(active.sleepStart)} · {dateLabel(active.sleepStart)}</Text><Label>UTC {offsetLabel(active.sleepStart)}</Label></View>
        {correction ? <View style={ui.card}><TimeFields label="SLEEP START" value={correction.value} onChange={value => setCorrection({ ...correction, value })} disabled={busy} /><OutlineButton label="SAVE START TIME" disabled={busy} onPress={() => { void run(async () => { await repository.correctStart(correction.id, parseTimestamp(correction.value.time, correction.value.offset), correction.revision); setCorrection(null); }); }} /><OutlineButton label="CANCEL EDIT" disabled={busy} onPress={() => setCorrection(null)} /></View> : cancel ? <View style={ui.card}><Secondary>Discard the current start? No completed sleep record will be created.</Secondary><OutlineButton label="DISCARD CURRENT START" disabled={busy} onPress={() => { void run(async () => { await repository.cancel(active.id); setCancel(false); }); }} /><OutlineButton label="KEEP SLEEPING" disabled={busy} onPress={() => setCancel(false)} /></View> : <>
          <OutlineButton primary label={busy ? 'SAVING' : 'WAKE UP'} disabled={disabled} onPress={() => { const id = active.id; void run(async () => { setSummary(await repository.wake(id)); }); }} />
          <Disclosure title="Zeit korrigieren oder Start verwerfen">
          <OutlineButton label="CORRECT START TIME" disabled={disabled} onPress={() => { setError(null); setCorrection({ id: active.id, revision: data.revision, value: timestampFields(active.sleepStart) }); }} />
          <OutlineButton label="STARTED BY MISTAKE" disabled={disabled} onPress={() => { setError(null); setCancel(true); }} />
          </Disclosure>
        </>}
      </> : <>
        <Secondary>Öffne deinen Tag. Oder starte deine Schlafzeit bewusst, wenn du schlafen gehst.</Secondary>
        <OutlineButton primary label="NOT NOW · OPEN APP" disabled={disabled} highlighted={transition.highlighted} onPress={transition.start} />
        <OutlineButton label={busy ? 'SAVING' : 'GO TO SLEEP'} disabled={disabled} onPress={() => { void run(() => startSleep(data.revision)); }} />
      </>}
      <ErrorMessage message={error} />
    </View>
    <View style={styles.footer}><Label>REST WITH INTENTION.</Label><Secondary>Sleep and wake times stay on this device.</Secondary></View>
  </Animated.View></ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#000' }, scroll: { flexGrow: 1 }, shell: { flex: 1, maxWidth: 520, width: '100%', alignSelf: 'center', paddingHorizontal: 28 }, header: { paddingTop: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 }, main: { flex: 1, justifyContent: 'center', paddingVertical: 48, gap: 22 }, title: { color: '#FFF', fontWeight: '800', letterSpacing: -4 }, duration: { color: '#FFF', fontSize: 44, letterSpacing: -1.8, fontWeight: '600', fontVariant: ['tabular-nums'] }, footer: { backgroundColor: '#141414', borderRadius: 20, borderWidth: 1, borderColor: '#292929', padding: 20, marginBottom: 20, gap: 8 } });
