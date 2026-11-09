import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Label, Secondary, ToolPage, ui } from '../../../../../src/components/ToolPage';
import { DataBoundary, MissingTimer, useTimer } from '../../../../../src/features/quit/components';
import { dateText, exactDuration, pad } from '../../../../../src/features/quit/model';
export default function AttemptScreen() { return <DataBoundary><Attempt /></DataBoundary>; }
function Attempt() {
  const { timer } = useTimer();
  const { attemptId } = useLocalSearchParams<{ attemptId: string }>();
  if (!timer) return <MissingTimer />;
  const index = timer.history.findIndex(a => a.id === attemptId);
  const attempt = timer.history[index];
  if (!attempt) return <ToolPage title="ATTEMPT NOT FOUND" back={`/quit/${timer.id}`}><Secondary>This attempt is not available.</Secondary></ToolPage>;
  return <ToolPage title={`ATTEMPT ${pad(index + 1)}`} back={`/quit/${timer.id}`}>
    <Label>{timer.title.toUpperCase()}</Label>
    <View style={[ui.section, ui.card]}><Label>STARTED</Label><Text style={ui.title}>{dateText(attempt.startedAt)}</Text><Label>ENDED</Label><Text style={ui.title}>{dateText(attempt.endedAt)}</Text></View>
    <View style={ui.divider} />
    <View style={[ui.section, ui.card]}><Label>EXACT DURATION</Label><Text style={[ui.numeric, { fontSize: 22, lineHeight: 34 }]}>{exactDuration(attempt.duration)}</Text></View>
    {attempt.clockAdjusted && <Secondary>The device clock moved before the start time. The original dates are preserved; this attempt’s duration is zero.</Secondary>}
    <View style={ui.divider} />
    <View style={[ui.section, ui.card]}><Label>REASON</Label><Text style={ui.title}>{attempt.reason ?? 'Not provided'}</Text><Label>PRIVATE NOTE</Label><Text selectable style={[ui.secondary, { color: '#FFFFFF' }]}>{attempt.note ?? 'No note added.'}</Text></View>
  </ToolPage>;
}
