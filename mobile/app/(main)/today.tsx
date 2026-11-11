import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Label, Secondary, ToolPage, ui } from '../../src/components/ToolPage';
import { OutlineButton } from '../../src/components/OutlineButton';
import { useSession } from '../../src/features/session/SessionProvider';
import { useRunning } from '../../src/features/running/RunProvider';
import { useOverview } from '../../src/features/overview/useOverview';
export default function Today() {
  const router = useRouter(); const { data } = useRunning(); const overview = useOverview();
  const { todayEntrance, finishTodayEntrance } = useSession(); const [entrance] = useState(todayEntrance);
  const opacity = useRef(new Animated.Value(entrance ? 0 : 1)).current; const y = useRef(new Animated.Value(entrance && !entrance.reducedMotion ? 8 : 0)).current;
  useEffect(() => { if (!entrance) return; const animation = Animated.parallel([Animated.timing(opacity, { toValue: 1, duration: entrance.reducedMotion ? 120 : 300, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }), ...(entrance.reducedMotion ? [] : [Animated.timing(y, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' })])]); animation.start(({ finished }) => { if (finished) finishTodayEntrance(entrance.id); }); return () => { animation.stop(); finishTodayEntrance(entrance.id); }; }, [entrance, finishTodayEntrance, opacity, y]);
  const shortcuts = [
    { title: data.draft ? 'Deinen Lauf öffnen' : 'Laufen', detail: data.draft ? 'Pausierten oder laufenden Lauf ansehen' : 'GPS-Aufzeichnung starten', href: '/running?from=today&view=overview' },
    { title: 'Essen erfassen', detail: overview.errors.includes('nutrition') ? 'Ernährung öffnen' : `${overview.foodCount} ${overview.foodCount === 1 ? 'Eintrag' : 'Einträge'} heute`, href: '/nutrition?action=scan&from=today' },
    { title: 'Trade eintragen', detail: overview.errors.includes('trading') ? 'Trading öffnen' : `${overview.tradeCount} ${overview.tradeCount === 1 ? 'Trade' : 'Trades'} heute`, href: '/trading?action=new&from=today' },
  ];
  return <Animated.View testID="today-content" style={{ flex: 1, opacity, transform: [{ translateY: y }] }}><ToolPage title="TODAY"><Label>{new Date().toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}</Label>
    <View style={styles.hero}><Text style={styles.headline}>{'Ein Schritt zählt.'}</Text><OutlineButton primary label="Bereiche öffnen" onPress={() => router.push('/areas')} /></View>
    <View style={styles.status}><View style={{ flex: 1, gap: 6 }}><Label>LETZTER SCHLAF</Label><Text style={ui.title}>{overview.loading ? '…' : overview.errors.includes('sleep') ? 'Nicht verfügbar' : overview.lastSleep || 'Noch kein Eintrag'}</Text></View><Pressable accessibilityRole="button" onPress={() => router.push('/sleep?from=today&view=overview')} style={ui.textButton}><Text style={ui.small}>ANSEHEN</Text></Pressable></View>
    <View style={{ marginTop: 20, gap: 10 }}><Label>SCHNELLZUGRIFF</Label>{shortcuts.map(item => <Pressable key={item.href} accessibilityRole="button" accessibilityLabel={item.title} onPress={() => router.push(item.href as never)} style={styles.shortcut}><Text style={ui.title}>{item.title}</Text><Secondary>{overview.loading && item.title !== 'Laufen' ? 'Öffnen' : item.detail}</Secondary></Pressable>)}</View>
  </ToolPage></Animated.View>;
}
const styles = StyleSheet.create({ hero: { marginTop: 22, gap: 20, backgroundColor: '#141414', borderRadius: 20, borderWidth: 1, borderColor: '#292929', padding: 22 }, headline: { color: '#FFF', fontSize: 28, lineHeight: 34, fontWeight: '600', letterSpacing: -1.5 }, status: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderColor: '#292929' }, shortcut: { minHeight: 72, justifyContent: 'center', gap: 4, borderRadius: 18, backgroundColor: '#141414', borderWidth: 1, borderColor: '#292929', paddingHorizontal: 20, paddingVertical: 14 } });
