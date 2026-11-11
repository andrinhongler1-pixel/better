import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius } from '../theme/tokens';

export function ToolPage({ title, children, back }: { title: string; children: ReactNode; back?: string }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string }>();
  const main = ['TODAY', 'AREAS', 'HISTORY'].includes(title);
  const target = params.from === 'history' ? '/history' : params.from === 'today' ? '/today' : back || (!main ? '/areas' : undefined);
  const titles: Record<string, string> = { TODAY: 'Heute', AREAS: 'Bereiche', HISTORY: 'Verlauf', SLEEP: 'Schlaf', NUTRITION: 'Ernährung', RUNNING: 'Laufen', TRADING: 'Trading', GOALS: 'Ziele', QUIT: 'Quit', PROGRESS: 'Fortschritt' };
  return <KeyboardAvoidingView style={ui.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={ui.page}>
      <View style={ui.top}><Text style={ui.brand}>better.</Text>{target && <Pressable accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => router.replace(target as never)} style={ui.textButton}><Text style={ui.small}>{target === '/areas' ? 'BEREICHE' : 'ZURÜCK'}</Text></Pressable>}</View>
      <Text accessibilityRole="header" style={ui.heading}>{titles[title] || title}</Text>
      <View style={{ height: 24 }} />
      {children}
    </ScrollView>
  </KeyboardAvoidingView>;
}
export function Label({ children }: { children: ReactNode }) { return <Text style={ui.label}>{children}</Text>; }
export function Secondary({ children }: { children: ReactNode }) { return <Text style={ui.secondary}>{children}</Text>; }
export function ErrorMessage({ message }: { message: string | null }) { return message ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={ui.error}>{message}</Text> : null; }
export const ui = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  page: { flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 24, paddingBottom: 112 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 18, marginBottom: 24 },
  brand: { color: colors.text, fontSize: 30, fontWeight: '700', letterSpacing: -1.8 },
  heading: { color: colors.text, fontSize: 34, fontWeight: '700', letterSpacing: -1.2, flexShrink: 1 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 24, opacity: 0.7 },
  label: { color: colors.muted, fontSize: 10, fontWeight: '500', letterSpacing: 1.5, lineHeight: 18 },
  small: { color: colors.text, fontSize: 10, fontWeight: '600', letterSpacing: 1.1 },
  secondary: { color: colors.muted, fontSize: 14, lineHeight: 24 },
  section: { gap: 16, paddingVertical: 4 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, padding: 22, gap: 18 },
  input: { color: colors.text, backgroundColor: '#1C1C1C', borderWidth: 1, borderColor: colors.line, borderRadius: radius.control, paddingHorizontal: 18, paddingVertical: 18, fontSize: 16, minHeight: 58 },
  error: { color: colors.text, fontSize: 13, lineHeight: 21, marginVertical: 16 },
  textButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.surface },
  title: { color: colors.text, fontSize: 16, fontWeight: '600', letterSpacing: 0.3, lineHeight: 24 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' },
  numeric: { color: colors.text, fontVariant: ['tabular-nums'], fontWeight: '500' },
});
