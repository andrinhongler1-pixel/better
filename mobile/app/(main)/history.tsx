import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Label, Secondary, ToolPage, ui } from '../../src/components/ToolPage';
import { OutlineButton } from '../../src/components/OutlineButton';
import { useOverview } from '../../src/features/overview/useOverview';
import { kindNames } from '../../src/features/overview/model';
import type { HistoryKind } from '../../src/features/overview/model';
export default function History() {
  const { items, errors, loading, refresh } = useOverview(); const router = useRouter();
  const [filter, setFilter] = useState<HistoryKind | 'all'>('all'); const [limit, setLimit] = useState(40);
  const filtered = items.filter(item => filter === 'all' || item.kind === filter); let day = '';
  return <ToolPage title="HISTORY"><Secondary>Deine gespeicherten Einträge an einem Ort.</Secondary>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{(['all', 'running', 'nutrition', 'sleep', 'quit', 'trading'] as const).map(kind => <Pressable key={kind} accessibilityRole="button" accessibilityState={{ selected: filter === kind }} aria-pressed={filter === kind} onPress={() => { setFilter(kind); setLimit(40); }} style={[styles.chip, filter === kind && styles.chosen]}><Text style={[ui.small, filter === kind && { color: '#000' }]}>{kind === 'all' ? 'Alle' : kindNames[kind]}</Text></Pressable>)}</ScrollView>
    {errors.length > 0 && <View style={ui.card}><Secondary>Nicht geladen: {errors.map(k => kindNames[k]).join(', ')}. Vorhandene Daten bleiben erhalten.</Secondary><OutlineButton label="Erneut laden" onPress={() => { void refresh(); }} /></View>}
    {loading ? <Secondary>Einträge werden geladen.</Secondary> : !filtered.length ? <View style={[ui.card, { marginTop: 12 }]}><Text style={ui.title}>Noch keine Einträge.</Text><Secondary>Gespeicherte Läufe, Schlafzeiten, Mahlzeiten und Trades erscheinen hier.</Secondary></View> : <View style={{ gap: 10 }}>{filtered.slice(0, limit).map(item => { const heading = item.date !== day; day = item.date; return <View key={item.id}>{heading && <View style={{ marginTop: 18, marginBottom: 12 }}><Label>{new Date(`${item.date}T12:00:00`).toLocaleDateString('de-CH', { day: 'numeric', month: 'long', year: 'numeric' })}</Label></View>}<Pressable accessibilityRole="button" accessibilityLabel={`${item.title}, ${item.value}`} onPress={() => router.push(item.href as never)} style={styles.item}><View style={{ flex: 1, gap: 6 }}><Label>{kindNames[item.kind]}</Label><Text style={ui.title}>{item.title}</Text><Secondary>{item.detail}</Secondary></View><Text style={styles.value}>{item.value}</Text></Pressable></View>; })}</View>}
    {filtered.length > limit && <View style={{ marginTop: 20 }}><OutlineButton label="Weitere Einträge" onPress={() => setLimit(n => n + 40)} /></View>}
  </ToolPage>;
}
const styles = StyleSheet.create({ filters: { gap: 8, paddingVertical: 20 }, chip: { paddingHorizontal: 16, minHeight: 42, borderRadius: 999, backgroundColor: '#141414', borderWidth: 1, borderColor: '#292929', justifyContent: 'center' }, chosen: { backgroundColor: '#FFF', borderColor: '#FFF' }, item: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 16, borderRadius: 20, padding: 20, backgroundColor: '#141414', borderWidth: 1, borderColor: '#292929' }, value: { color: '#FFF', fontWeight: '600', fontSize: 15, fontVariant: ['tabular-nums'] } });
