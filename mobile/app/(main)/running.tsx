import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ErrorMessage, Label, Secondary, ToolPage, ui } from '../../src/components/ToolPage';
import { OutlineButton } from '../../src/components/OutlineButton';
import { useRunning } from '../../src/features/running/RunProvider';
import { clock, pace } from '../../src/features/running/model';
import { RouteView } from '../../src/features/running/RouteView';
import { useClock } from '../../src/features/quit/useClock';

function Metrics({ duration, meters }: { duration: number; meters: number }) { return <><Label>ACTIVE TIME</Label><Text style={styles.time}>{clock(duration)}</Text><View style={ui.row}><View style={styles.metric}><Label>DISTANCE</Label><Text style={styles.value}>{(meters / 1000).toFixed(2)}<Text style={styles.unit}> KM</Text></Text></View><View style={styles.metric}><Label>AVERAGE PACE</Label><Text style={styles.value}>{pace(duration, meters)}<Text style={styles.unit}> /KM</Text></Text></View></View></>; }
const date = (timestamp: number) => new Date(timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export default function Running() {
  const { data, status, repository, recorder, recording } = useRunning();
  const now = useClock(); const [selected, setSelected] = useState<string | null>(null); const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false); const locked = useRef(false); const [error, setError] = useState<string | null>(null);
  useFocusEffect(useCallback(() => () => { void recorder.pause('You left the running screen. Resume explicitly to continue.'); }, [recorder]));
  const draft = data.draft; const record = data.runs.find(r => r.id === selected);
  const duration = draft ? draft.elapsedMs + (recording.mode === 'recording' && draft.owner === recorder.owner ? Math.min(5000, Math.max(0, now - draft.checkpoint)) : 0) : 0;
  async function action(fn: () => Promise<unknown>) { if (locked.current) return; locked.current = true; setBusy(true); setError(null); try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Please retry.'); } finally { locked.current = false; setBusy(false); } }
  return <ToolPage title="RUNNING" back="/today">
    {status === 'loading' ? <Secondary>Opening your running journal.</Secondary> : status === 'error' ? <View style={ui.card}><ErrorMessage message="Your runs could not be loaded. Existing data has not been overwritten." /><OutlineButton label="RETRY" onPress={() => { void repository.load(); }} /></View> : <View style={ui.section}>
      {selected ? record ? <View style={ui.card}>
        <Label>{date(record.startedAt)}</Label><Metrics duration={record.durationMs} meters={record.distanceM} /><RouteView points={record.points} /><Secondary>GPS distance is approximate. Active time excludes pauses and unrecorded gaps.</Secondary><ErrorMessage message={error} />
        {deleting ? <><Secondary>Delete this saved run and its route from this device?</Secondary><OutlineButton label="CONFIRM DELETE RUN" disabled={busy} onPress={() => { void action(async () => { await repository.delete(record.id); setSelected(null); setDeleting(false); }); }} /><OutlineButton label="KEEP RUN" disabled={busy} onPress={() => setDeleting(false)} /></> : <><OutlineButton label="DELETE RUN" onPress={() => setDeleting(true)} /><OutlineButton label="BACK TO RUNNING" onPress={() => { setSelected(null); setError(null); }} /></>}
      </View> : <><Secondary>This run changed in another window.</Secondary><OutlineButton label="BACK TO RUNNING" onPress={() => setSelected(null)} /></> : <>
        <View style={ui.card} aria-busy={recording.mode !== 'idle'}>
          <Label>{recording.mode === 'locating' ? 'FINDING GPS' : recording.mode === 'recording' ? 'RECORDING · FOREGROUND ONLY' : draft ? draft.phase === 'recording' ? 'RECORDING IN ANOTHER WINDOW OR INTERRUPTED' : 'PAUSED' : 'YOUR NEXT RUN'}</Label>
          <Metrics duration={duration} meters={draft?.distanceM || 0} /><RouteView points={draft?.points || []} />
          {recording.message && <Secondary>{recording.message}</Secondary>}
          {draft?.reason && draft.reason !== recording.message && recording.mode === 'idle' && <Secondary>{draft.reason}</Secondary>}
          {draft && draft.phase === 'recording' && draft.owner !== recorder.owner && <Secondary>Recording is protected across windows. If the previous window was closed, wait 15 seconds, then resume. Only saved time and points will be recovered.</Secondary>}
          <ErrorMessage message={error} />
          {recording.mode !== 'idle' ? <OutlineButton label={recording.mode === 'locating' ? 'CANCEL GPS SEARCH' : 'PAUSE RUN'} disabled={busy} onPress={() => { void action(() => recorder.pause()); }} /> : <OutlineButton label={draft ? 'RESUME RUN' : 'START RUN'} disabled={busy} onPress={() => { setError(null); recorder.begin(draft?.id); }} />}
          {draft && <OutlineButton label="FINISH & SAVE RUN" disabled={busy} onPress={() => { const id = draft.id; void action(async () => { await recorder.finish(id); setSelected(id); }); }} />}
        </View>
        <View style={ui.card}><Label>KEEP THIS SCREEN OPEN</Label><Secondary>Allow location when asked. Keep the app visible and your iPhone unlocked. Leaving this screen, locking the phone or losing GPS pauses recording; tap RESUME RUN when you return.</Secondary><Secondary>{recording.awake ? 'A screen-awake request is active. iOS can still release it; keep the screen visible.' : 'Screen-awake support varies. Check that your phone stays unlocked.'}</Secondary><Secondary>Location and routes stay on this device. No Strava account or map service is used.</Secondary></View>
        <View style={ui.divider} /><Label>RUN HISTORY</Label>
        {[...data.runs].sort((a, b) => b.startedAt - a.startedAt).map(r => <Pressable key={r.id} accessibilityRole="button" accessibilityLabel={`Run ${date(r.startedAt)}, ${(r.distanceM / 1000).toFixed(2)} kilometres`} style={ui.card} onPress={() => { void action(async () => { await recorder.pause('Viewing run history. Resume explicitly to continue recording.'); setSelected(r.id); setDeleting(false); }); }}><View style={ui.row}><Text style={ui.title}>{date(r.startedAt)}</Text><Text style={ui.numeric}>{(r.distanceM / 1000).toFixed(2)} KM</Text></View><Label>{clock(r.durationMs)} · {pace(r.durationMs, r.distanceM)} /KM</Label></Pressable>)}
        {!data.runs.length && <Secondary>No completed runs yet.</Secondary>}
      </>}
    </View>}
  </ToolPage>;
}
const styles = StyleSheet.create({ time: { color: '#FFF', fontSize: 44, fontWeight: '600', fontVariant: ['tabular-nums'], letterSpacing: -2 }, metric: { gap: 8 }, value: { color: '#FFF', fontSize: 30, fontWeight: '600', fontVariant: ['tabular-nums'], letterSpacing: -1 }, unit: { color: '#8A8A8A', fontSize: 10, letterSpacing: .5 } });
