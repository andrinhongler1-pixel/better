import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Disclosure } from '../../src/components/Disclosure';
import { ErrorMessage, Label, Secondary, ToolPage, ui } from '../../src/components/ToolPage';
import { OutlineButton } from '../../src/components/OutlineButton';
import { useSleep } from '../../src/features/sleep/SleepProvider';
import { useSession } from '../../src/features/session/SessionProvider';
import { clockLabel, dateLabel, durationLabel, offsetLabel, parseTimestamp, sleepStats, timestampFields } from '../../src/features/sleep/model';
import type { SleepSession } from '../../src/features/sleep/model';
import { TimeFields } from '../../src/features/sleep/TimeFields';
import type { TimeValue } from '../../src/features/sleep/TimeFields';
import { useClock } from '../../src/features/quit/useClock';

export default function Sleep() {
  const params = useLocalSearchParams<{ sessionId?: string; view?: string }>();
  const { data, status, repository, startSleep } = useSleep();
  const { lock: lockSession } = useSession(); const router = useRouter();
  const stats = sleepStats(data.sessions, useClock());
  const [selected, setSelected] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ id: string; revision: number; start: TimeValue; wake: TimeValue } | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; revision: number } | null>(null);
  const [goal, setGoal] = useState<{ hours: string; minutes: string } | null>(null);
  const [busy, setBusy] = useState(false); const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const session = data.sessions.find(s => s.id === selected);
  useEffect(() => { if (status !== 'ready' || (!params.sessionId && !params.view)) return; setSelected(params.sessionId || null); setEditor(null); setDeleting(null); router.setParams({ sessionId: undefined, view: undefined }); }, [params.sessionId, params.view, status, router]);
  async function run(action: () => Promise<void>) { if (lock.current) return; lock.current = true; setBusy(true); setError(null); try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Try again.'); } finally { lock.current = false; setBusy(false); } }
  const close = () => { setSelected(null); setEditor(null); setDeleting(null); setGoal(null); setError(null); };
  const openEditor = (s: SleepSession) => { setEditor({ id: s.id, revision: data.revision, start: timestampFields(s.sleepStart), wake: timestampFields(s.wakeAt) }); setError(null); };
  return <ToolPage title="SLEEP">
    {status === 'loading' ? <Secondary>Opening your sleep journal.</Secondary> : status === 'error' ? <View style={ui.card}><ErrorMessage message="Sleep data could not be loaded. Existing data has not been overwritten." /><OutlineButton label="RETRY" onPress={() => { void repository.load(); }} /></View> : <View style={ui.section}>
      {editor ? <View style={ui.card}>
        <Label>CORRECT SLEEP SESSION</Label>
        <TimeFields label="SLEEP START" value={editor.start} onChange={start => setEditor({ ...editor, start })} disabled={busy} />
        <TimeFields label="WAKE UP" value={editor.wake} onChange={wake => setEditor({ ...editor, wake })} disabled={busy} />
        <Secondary>Duration is recalculated from both timestamps. No new session is created.</Secondary><ErrorMessage message={error} />
        <OutlineButton label="SAVE CORRECTION" disabled={busy} onPress={() => { void run(async () => { await repository.edit(editor.id, parseTimestamp(editor.start.time, editor.start.offset), parseTimestamp(editor.wake.time, editor.wake.offset), editor.revision); setEditor(null); }); }} />
        <OutlineButton label="CANCEL EDIT" disabled={busy} onPress={() => { setEditor(null); setError(null); }} />
      </View> : selected ? session ? <View style={ui.card}>
        <Label>SLEEP SESSION</Label><Text style={styles.duration}>{durationLabel(session.duration)}</Text>
        <Label>SLEEP START</Label><Text style={ui.title}>{dateLabel(session.sleepStart)} · {clockLabel(session.sleepStart)}</Text><Label>UTC {offsetLabel(session.sleepStart)}</Label>
        <Label>WAKE UP</Label><Text style={ui.title}>{dateLabel(session.wakeAt)} · {clockLabel(session.wakeAt)}</Text><Label>UTC {offsetLabel(session.wakeAt)}</Label>
        <Secondary>Time between recorded timestamps. Times are shown in your current device time zone.</Secondary><ErrorMessage message={error} />
        {deleting ? <><Secondary>Delete this session from this device? Your averages and chart will update.</Secondary><OutlineButton label="CONFIRM DELETE SESSION" disabled={busy} onPress={() => { void run(async () => { await repository.delete(deleting.id, deleting.revision); close(); }); }} /><OutlineButton label="KEEP SESSION" disabled={busy} onPress={() => setDeleting(null)} /></> : <><OutlineButton label="CORRECT TIMES" disabled={busy} onPress={() => openEditor(session)} /><OutlineButton label="DELETE SESSION" disabled={busy} onPress={() => { setDeleting({ id: session.id, revision: data.revision }); setError(null); }} /><OutlineButton label="BACK TO SLEEP" onPress={close} /></>}
      </View> : <View style={ui.card}><Secondary>This session changed in another tab.</Secondary><OutlineButton label="BACK TO SLEEP" onPress={close} /></View> : <>
        <OutlineButton primary label="GO TO SLEEP" disabled={busy} onPress={() => { void run(async () => { await startSleep(data.revision); lockSession(); router.replace('/'); }); }} />
        <View style={ui.card}><Label>LETZTE SCHLAFZEIT</Label><Text style={styles.duration}>{stats.last ? durationLabel(stats.last.duration) : '—'}</Text><Secondary>{stats.last ? `${dateLabel(stats.last.wakeAt)} · ${clockLabel(stats.last.sleepStart)} — ${clockLabel(stats.last.wakeAt)}` : 'Noch keine Schlafzeit gespeichert.'}</Secondary><View style={ui.row}><Label>Ø LETZTE {stats.recentCount || 7} SITZUNGEN</Label><Text style={ui.title}>{stats.average === null ? '—' : durationLabel(stats.average)}</Text></View></View>
        <Disclosure title="Wochenübersicht"><View style={ui.card}><View style={ui.row}><Label>WEEKLY SLEEP</Label><Label>BY WAKE DATE</Label></View>
          <View style={styles.chart}>{stats.week.map(day => <View key={day.date} style={styles.column} accessibilityLabel={`${day.date}, ${day.count ? durationLabel(day.duration) : 'no session'}`}>
            <Text style={styles.chartValue}>{day.count ? `${(day.duration / 3600000).toFixed(1)}h` : '—'}</Text><View style={styles.track}><View style={[styles.bar, { height: `${day.count ? Math.max(2, day.duration / Math.max(data.goalMinutes * 60000, ...stats.week.map(d => d.duration)) * 100) : 0}%` }]} /></View><Text style={styles.chartValue}>{day.label}</Text><Text style={styles.chartValue}>{day.date.slice(8)}</Text>
          </View>)}</View><Secondary>Completed time per day. Multiple sessions on one day are added together.</Secondary>
        </View></Disclosure>
        <Disclosure title={`Schlafziel · ${durationLabel(data.goalMinutes * 60000)}`}><View style={ui.card}><Label>SLEEP GOAL</Label><Text style={ui.title}>{durationLabel(data.goalMinutes * 60000)}</Text>
          {goal ? <><Label>HOURS</Label><TextInput accessibilityLabel="Sleep goal hours" value={goal.hours} onChangeText={hours => setGoal({ ...goal, hours })} keyboardType="number-pad" inputMode="numeric" style={ui.input} editable={!busy} maxLength={2} /><Label>MINUTES</Label><TextInput accessibilityLabel="Sleep goal minutes" value={goal.minutes} onChangeText={minutes => setGoal({ ...goal, minutes })} keyboardType="number-pad" inputMode="numeric" style={ui.input} editable={!busy} maxLength={2} /><ErrorMessage message={error} />
            <OutlineButton label="SAVE SLEEP GOAL" disabled={busy} onPress={() => { void run(async () => { if (!/^\d{1,2}$/.test(goal.hours) || !/^\d{1,2}$/.test(goal.minutes) || Number(goal.minutes) > 59) throw new Error('Enter hours and 0–59 minutes.'); await repository.setGoal(Number(goal.hours) * 60 + Number(goal.minutes)); setGoal(null); }); }} /><OutlineButton label="CANCEL GOAL" disabled={busy} onPress={() => { setGoal(null); setError(null); }} />
          </> : <OutlineButton label="CHANGE SLEEP GOAL" onPress={() => { setError(null); setGoal({ hours: String(Math.floor(data.goalMinutes / 60)), minutes: String(data.goalMinutes % 60) }); }} />}
        </View></Disclosure>
        <ErrorMessage message={goal ? null : error} />
        <View style={ui.divider} /><Label>SLEEP HISTORY</Label>
        {stats.sorted.length ? stats.sorted.map(s => <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={`Sleep session ${dateLabel(s.wakeAt)}, ${durationLabel(s.duration)}`} onPress={() => { close(); setSelected(s.id); }} style={ui.card}><View style={ui.row}><Text style={ui.title}>{dateLabel(s.wakeAt)}</Text><Text style={ui.numeric}>{durationLabel(s.duration)}</Text></View><Label>{clockLabel(s.sleepStart)} — {clockLabel(s.wakeAt)}</Label></Pressable>) : <Secondary>No sleep sessions recorded yet.</Secondary>}
        <Disclosure><Secondary>This tracks time between button presses, not medically verified sleep. No time-of-day rules or automatic sleep detection. Stored only on this device.</Secondary></Disclosure>
      </>}
    </View>}
  </ToolPage>;
}
const styles = StyleSheet.create({ duration: { color: '#FFF', fontSize: 38, fontWeight: '600', letterSpacing: -1.5, fontVariant: ['tabular-nums'] }, chart: { flexDirection: 'row', gap: 8, paddingVertical: 12 }, column: { flex: 1, alignItems: 'center', gap: 8 }, track: { height: 112, width: '100%', maxWidth: 24, backgroundColor: '#252525', borderRadius: 12, justifyContent: 'flex-end', overflow: 'hidden' }, bar: { backgroundColor: '#FFF', width: '100%', borderRadius: 12 }, chartValue: { color: '#8A8A8A', fontSize: 9 } });
