import { View } from 'react-native';
import { Label } from '../../components/ToolPage';
import type { PlanFieldProps } from './PlanField';
export function PlanField({ label, value, onChange, type, disabled }: PlanFieldProps) { return <View style={{ gap: 8 }}><Label>{label}</Label><input aria-label={label} type={type} value={value} onInput={event => onChange(event.currentTarget.value)} onChange={event => onChange(event.currentTarget.value)} disabled={disabled} style={{ colorScheme: 'dark', boxSizing: 'border-box', width: '100%', minWidth: 0, minHeight: 58, border: '1px solid #292929', borderRadius: 18, color: '#FFF', background: '#1C1C1C', padding: '16px 14px', fontSize: 16, fontFamily: 'inherit' }} /></View>; }
