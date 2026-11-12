import { TextInput, View } from 'react-native';
import { Label, ui } from '../../components/ToolPage';
export interface PlanFieldProps { label: string; value: string; onChange: (value: string) => void; type?: 'date' | 'time'; disabled?: boolean }
export function PlanField({ label, value, onChange, type, disabled }: PlanFieldProps) { return <View style={{ gap: 8 }}><Label>{label}</Label><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} style={ui.input} editable={!disabled} autoCorrect={false} autoCapitalize="none" placeholder={type === 'date' ? 'JJJJ-MM-TT' : 'HH:MM'} placeholderTextColor="#8A8A8A" maxLength={type === 'date' ? 10 : 5} /></View>; }
