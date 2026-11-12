import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Label, Secondary, ToolPage, ui } from '../../src/components/ToolPage';
import { OutlineButton } from '../../src/components/OutlineButton';
import { useSession } from '../../src/features/session/SessionProvider';
import { useRunning } from '../../src/features/running/RunProvider';
import { useOverview } from '../../src/features/overview/useOverview';
import { usePlanner } from '../../src/features/planner/PlannerProvider';
import { localDate, tasksForDay, taskTime } from '../../src/features/planner/model';
export default function Today() {
  const router = useRouter(); const { data } = useRunning(); const overview = useOverview();
  const planner = usePlanner(); const planDate = localDate(); const planned = tasksForDay(planner.data.tasks, planDate); const upcoming = planned.filter(t => !t.done).slice(0, 2);
  const { todayEntrance, finishTodayEntrance } = useSession(); const [entrance] = useState(todayEntrance);
  const opacity = useRef(new Animated.Value(entrance ? 0 : 1)).current; const y = useRef(new Animated.Value(entrance && !entrance.reducedMotion ? 8 : 0)).current;
  useEffect(() => { if (!entrance) return; const animation = Animated.parallel([Animated.timing(opacity, { toValue: 1, duration: entrance.reducedMotion ? 120 : 300, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }), ...(entrance.reducedMotion ? [] : [Animated.timing(y, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' })])]); animation.start(({ finished }) => { if (finished) finishTodayEntrance(entrance.id); }); return () => { animation.stop(); finishTodayEntrance(entrance.id); }; }, [entrance, finishTodayEntrance, opacity, y]);
  const shortcuts = [
    { title: data.draft ? 'Deinen Lauf öffnen' : 'Laufen', detail: data.draft ? 'Pausierten oder laufenden Lauf ansehen' : 'GPS-Aufzeichnung starten', href: '/running?from=today&view=overview' },
    { title: 'Essen erfassen', detail: overview.errors.includes('nutrition') ? 'Ernährung öffnen' : `${overview.foodCount} ${overview.foodCount === 1 ? 'Eintrag' : 'Einträge'} heute`, href: '/nutrition?action=scan&from=today' },
    { title: 'Trade eintragen', detail: overview.errors.includes('trading') ? 'Trading öffnen' : `${overview.tradeCount} ${overview.tradeCount === 1 ? 'Trade' : 'Trades'} heute`, href: '/trading?action=new&from=today' },
  ];
  return <Animated.View testID="today-content" style={{ flex: 1, opacity, transform: [{ translateY: y }] }}><ToolPage title="TODAY"><Label>{new Date().toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}</Label>
    <View style={styles.hero}><View style={ui.row}><Label>DEIN TAGESPLAN</Label>{planner.status === 'ready' && <Label>{planned.filter(t => t.done).length}/{planned.length} ERLEDIGT</Label>}</View>{planner.status === 'loading' ? <Secondary>Plan wird geladen.</Secondary> : planner.status === 'error' ? <Secondary>Dein Plan ist gerade nicht verfügbar.</Secondary> : !planned.length ? <Text style={styles.headline}>Platz für deinen Tag.</Text> : upcoming.length ? <View style={{ gap: 14 }}>{upcoming.map(task => <View key={task.id} style={{ gap: 4 }}><Label>{taskTime(task)}</Label><Text style={ui.title} numberOfLines={2}>{task.title}</Text></View>)}</View> : <Text style={ui.title}>Alles für heute erledigt.</Text>}<OutlineButton primary label="Tagesplan öffnen" onPress={() => router.push(`/planner?date=${planDate}&mode=day&from=today` as never)} /></View>
    <View style={styles.status}><View style={{ flex: 1, gap: 6 }}><Label>LETZTER SCHLAF</Label><Text style={ui.title}>{overview.loading ? '…' : overview.errors.includes('sleep') ? 'Nicht verfügbar' : overview.lastSleep || 'Noch kein Eintrag'}</Text></View><Pressable accessibilityRole="button" onPress={() => router.push('/sleep?from=today&view=overview')} style={ui.textButton}><Text style={ui.small}>ANSEHEN</Text></Pressable></View>
    <View style={{ marginTop: 20, gap: 10 }}><Label>SCHNELLZUGRIFF</Label>{shortcuts.map(item => <Pressable key={item.href} accessibilityRole="button" accessibilityLabel={item.title} onPress={() => router.push(item.href as never)} style={styles.shortcut}><Text style={ui.title}>{item.title}</Text><Secondary>{overview.loading && item.title !== 'Laufen' ? 'Öffnen' : item.detail}</Secondary></Pressable>)}</View>
  </ToolPage></Animated.View>;
}
const styles = StyleSheet.create({ hero: { marginTop: 22, gap: 20, backgroundColor: '#141414', borderRadius: 20, borderWidth: 1, borderColor: '#292929', padding: 22 }, headline: { color: '#FFF', fontSize: 28, lineHeight: 34, fontWeight: '600', letterSpacing: -1.5 }, status: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderColor: '#292929' }, shortcut: { minHeight: 72, justifyContent: 'center', gap: 4, borderRadius: 18, backgroundColor: '#141414', borderWidth: 1, borderColor: '#292929', paddingHorizontal: 20, paddingVertical: 14 } });
