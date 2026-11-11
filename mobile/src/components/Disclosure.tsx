import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ui } from './ToolPage';
export function Disclosure({ title = 'Hinweise', children }: { title?: string; children: ReactNode }) { const [open, setOpen] = useState(false); return <View style={{ borderTopWidth: 1, borderColor: '#292929', marginTop: 6 }}><Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} aria-expanded={open} onPress={() => setOpen(!open)} style={{ minHeight: 48, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><Text style={ui.secondary}>{title}</Text><Text style={ui.secondary}>{open ? '−' : '+'}</Text></Pressable>{open && <View style={{ gap: 12, paddingBottom: 16 }}>{children}</View>}</View>; }
