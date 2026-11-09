import { View, TextInput } from 'react-native';
import { Label, Secondary, ui } from '../../components/ToolPage';
import type { TimeValue } from './TimeFields';
export function TimeFields({ label, value, onChange, disabled }: { label: string; value: TimeValue; onChange: (next: TimeValue) => void; disabled?: boolean }) {
  return <View style={{ gap: 10 }}><Label>{label}</Label><input aria-label={`${label} date and time`} type="datetime-local" step="1" value={value.time} onChange={event => onChange({ ...value, time: event.target.value })} disabled={disabled} style={{ colorScheme: 'dark', boxSizing: 'border-box', width: '100%', minWidth: 0, color: '#FFF', background: '#1C1C1C', border: '1px solid #292929', borderRadius: 18, minHeight: 58, padding: '16px 12px', fontSize: 16, fontFamily: 'inherit' }} /><Label>UTC OFFSET</Label><TextInput accessibilityLabel={`${label} UTC offset`} style={ui.input} value={value.offset} onChangeText={offset => onChange({ ...value, offset })} autoCapitalize="none" autoCorrect={false} editable={!disabled} maxLength={6} /><Secondary>The offset belongs to this time. Keep it unless correcting a time-zone or daylight-saving change.</Secondary></View>;
}
