import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { OutlineButton } from '../../../../src/components/OutlineButton';
import { ErrorMessage, Label, Secondary, ToolPage, ui } from '../../../../src/components/ToolPage';
import { ClockNotice, DataBoundary, MissingTimer, Streak, useTimer } from '../../../../src/features/quit/components';
import { useQuitAction } from '../../../../src/features/quit/QuitProvider';
import { RESET_REASONS, statistics } from '../../../../src/features/quit/model';
import type { ResetReason } from '../../../../src/features/quit/model';
import { useClock } from '../../../../src/features/quit/useClock';

export default function ResetScreen() { return <DataBoundary><Reset /></DataBoundary>; }
function Reset() {
  const { timer, repository } = useTimer();
  const expectedStartAt = useRef(timer?.currentStartAt);
  const [reason, setReason] = useState<ResetReason>();
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState('');
  const { busy, error, run } = useQuitAction();
  const router = useRouter();
  const now = useClock();
  if (!timer) return <MissingTimer />;
  const stats = statistics(timer, now);
  return <ToolPage title="YOU SLIPPED.">
    <Label>{timer.title.toUpperCase()}</Label>
    <View style={ui.section}><Label>CURRENT STREAK</Label><Streak duration={stats.current} /><ClockNotice behind={stats.clockBehind} /></View>
    <View style={ui.divider} />
    <View style={ui.section}><Label>WHAT HAPPENED?</Label><Secondary>Optional. A moment to understand.</Secondary>
      <View style={styles.reasons}>{RESET_REASONS.map(item => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: reason === item }} aria-pressed={reason === item} disabled={busy} onPress={() => setReason(reason === item ? undefined : item)} style={[styles.reason, reason === item && styles.selected]}><Text style={[styles.reasonText, reason === item && { color: '#000000' }]}>{item}</Text></Pressable>)}</View>
      {!showNote ? <Pressable accessibilityRole="button" onPress={() => setShowNote(true)} style={ui.textButton}><Text style={ui.small}>ADD NOTE</Text></Pressable> : <><Label>PRIVATE NOTE · OPTIONAL</Label><TextInput accessibilityLabel="Private note" value={note} onChangeText={setNote} multiline maxLength={500} editable={!busy} placeholder="What led to this moment?" placeholderTextColor="#8A8A8A" style={[ui.input, styles.note]} /><Secondary>{note.length} / 500 · stored on this device</Secondary></>}
    </View>
    <View style={ui.divider} />
    <Secondary>This attempt will be saved to history. A new streak starts when you confirm.</Secondary>
    <ErrorMessage message={error} />
    <View style={styles.actions}><OutlineButton label={busy ? 'SAVING…' : 'RESET TIMER'} disabled={busy} onPress={() => { void run(() => repository.reset(timer.id, expectedStartAt.current!, reason, note), () => router.replace(`/quit/${timer.id}`)); }} />
      <Pressable accessibilityRole="button" disabled={busy} style={styles.cancel} onPress={() => router.replace(`/quit/${timer.id}`)}><Text style={ui.small}>CANCEL</Text></Pressable></View>
  </ToolPage>;
}
const styles = StyleSheet.create({
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  reason: { borderWidth: 1, borderColor: '#292929', borderRadius: 999, backgroundColor: '#141414', minHeight: 48, paddingHorizontal: 18, justifyContent: 'center' },
  selected: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' }, reasonText: { color: '#FFFFFF', fontSize: 10, letterSpacing: 1.2 },
  note: { minHeight: 120, textAlignVertical: 'top' }, actions: { gap: 12, marginTop: 28, padding: 20, backgroundColor: '#141414', borderRadius: 20 }, cancel: { alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: 18 },
});
