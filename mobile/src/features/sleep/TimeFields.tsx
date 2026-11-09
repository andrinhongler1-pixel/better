import { TextInput, View } from 'react-native';
import { Label, Secondary, ui } from '../../components/ToolPage';
export interface TimeValue { time: string; offset: string }
export function TimeFields({ label, value, onChange, disabled }: { label: string; value: TimeValue; onChange: (next: TimeValue) => void; disabled?: boolean }) {
  return <View style={{ gap: 10 }}><Label>{label}</Label><TextInput accessibilityLabel={`${label} date and time`} style={ui.input} value={value.time} onChangeText={time => onChange({ ...value, time })} placeholder="2026-11-09T23:15:00" placeholderTextColor="#8A8A8A" autoCapitalize="none" autoCorrect={false} editable={!disabled} maxLength={19} /><Label>UTC OFFSET</Label><TextInput accessibilityLabel={`${label} UTC offset`} style={ui.input} value={value.offset} onChangeText={offset => onChange({ ...value, offset })} autoCapitalize="none" autoCorrect={false} editable={!disabled} maxLength={6} /><Secondary>Use YYYY-MM-DDTHH:MM:SS. Keep the offset for this time; change it if daylight saving time or your time zone changed.</Secondary></View>;
}
