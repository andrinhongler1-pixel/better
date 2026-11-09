import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { OutlineButton } from '../../../../src/components/OutlineButton';
import { ErrorMessage, Label, Secondary, ToolPage, ui } from '../../../../src/components/ToolPage';
import { DataBoundary, MissingTimer, useTimer } from '../../../../src/features/quit/components';
import { useQuitAction } from '../../../../src/features/quit/QuitProvider';
export default function DeleteScreen() { return <DataBoundary><Delete /></DataBoundary>; }
function Delete() {
  const { timer, repository } = useTimer();
  const { busy, error, run } = useQuitAction();
  const router = useRouter();
  if (!timer) return <MissingTimer />;
  return <ToolPage title="DELETE TIMER?">
    <View style={[ui.section, ui.card]}><Label>{timer.title.toUpperCase()}</Label><Secondary>This will permanently delete this timer and its history.</Secondary><ErrorMessage message={error} />
      <View style={{ marginTop: 32 }}><OutlineButton label={busy ? 'DELETING…' : 'DELETE'} disabled={busy} onPress={() => { void run(() => repository.delete(timer.id), () => router.replace('/quit')); }} /></View>
      <Pressable accessibilityRole="button" disabled={busy} style={[ui.textButton, { alignItems: 'center' }]} onPress={() => router.replace(`/quit/${timer.id}`)}><Text style={ui.small}>CANCEL</Text></Pressable>
    </View>
  </ToolPage>;
}
