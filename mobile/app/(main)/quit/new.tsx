import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { OutlineButton } from '../../../src/components/OutlineButton';
import { ErrorMessage, Label, Secondary, ToolPage, ui } from '../../../src/components/ToolPage';
import { useQuit, useQuitAction } from '../../../src/features/quit/QuitProvider';
import { DataBoundary } from '../../../src/features/quit/components';

export default function NewTimerScreen() { return <DataBoundary><NewTimer /></DataBoundary>; }
function NewTimer() {
  const [title, setTitle] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [date, setDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  const [time, setTime] = useState('00:00');
  const [dateError, setDateError] = useState<string | null>(null);
  const { repository } = useQuit();
  const { busy, error, run } = useQuitAction();
  const router = useRouter();
  const submit = () => {
    if (!title.trim()) return;
    setDateError(null);
    if (!restoring) { void run(() => repository.create(title), () => router.replace('/quit')); return; }
    const start = new Date(`${date}T${time}:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || !Number.isFinite(start.getTime()) || start.getFullYear() !== Number(date.slice(0, 4)) || start.getMonth() + 1 !== Number(date.slice(5, 7)) || start.getDate() !== Number(date.slice(8, 10)) || start.getHours() !== Number(time.slice(0, 2)) || start.getMinutes() !== Number(time.slice(3)) || start.getTime() > Date.now()) { setDateError('Enter a valid date and time in the past.'); return; }
    void run(() => repository.restore(title, start.getTime()), () => router.replace('/quit'));
  };
  return <ToolPage title="NEW TIMER" back="/quit">
    <View style={[ui.section, ui.card]}>
      <Label>WHAT ARE YOU QUITTING?</Label>
      <TextInput accessibilityLabel="What are you quitting?" style={ui.input} placeholder="YOUR OWN WORDS" placeholderTextColor="#8A8A8A" value={title} onChangeText={setTitle} maxLength={80} autoCapitalize="characters" returnKeyType="done" onSubmitEditing={submit} editable={!busy} />
      <Secondary>For example: no nicotine, no doomscrolling.{'\n'}Use any title that means something to you.</Secondary>
      <OutlineButton label={restoring ? 'USE CURRENT TIME' : 'RESTORE EARLIER START'} disabled={busy} onPress={() => { setRestoring(!restoring); setDateError(null); }} />
      {restoring && <><Label>ORIGINAL START DATE (YYYY-MM-DD)</Label><TextInput accessibilityLabel="Original start date" style={ui.input} value={date} onChangeText={setDate} editable={!busy} autoCorrect={false} autoCapitalize="none" /><Label>ORIGINAL START TIME (HH:MM)</Label><TextInput accessibilityLabel="Original start time" style={ui.input} value={time} onChangeText={setTime} editable={!busy} autoCorrect={false} autoCapitalize="none" /><Secondary>Uses your device's local time zone. Recreates the running streak from this time; previous attempts cannot be reconstructed. Existing timers will not be overwritten.</Secondary></>}
      <ErrorMessage message={dateError || error} />
      <View style={{ marginTop: 24 }}><OutlineButton label={busy ? 'SAVING…' : restoring ? 'RESTORE TIMER' : 'START TIMER'} disabled={busy || !title.trim()} onPress={submit} /></View>
      <Secondary>{restoring ? 'Saved with the original start time on this device.' : 'Starts now. Saved on this device.'}</Secondary>
    </View>
  </ToolPage>;
}
