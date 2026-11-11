import { Redirect, Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../src/features/session/SessionProvider';
import { useSleep } from '../../src/features/sleep/SleepProvider';
import { mainSections, sectionForRoute } from '../../src/features/overview/navigation';
const tools = ['goals', 'quit', 'trading', 'nutrition', 'sleep', 'progress', 'running'] as const;
export default function MainLayout() {
  const { unlocked } = useSession(); const { data, status } = useSleep();
  if (!unlocked || data.active || status === 'loading') return <Redirect href="/" />;
  return <SafeAreaView style={styles.screen}><Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: '#000' } }} tabBar={({ state, navigation }) => <View style={styles.dock} pointerEvents="box-none"><View style={styles.navigation} accessibilityRole="tablist">
    {mainSections.map(section => { const route = state.routes.find(r => r.name === section.route); if (!route) return null; const active = sectionForRoute(state.routes[state.index]!.name) === section.route;
      return <Pressable key={route.key} accessibilityRole="tab" accessibilityState={{ selected: active }} aria-selected={active} onPress={() => { const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true }); if (!event.defaultPrevented) navigation.navigate(route.name); }} style={[styles.tab, active && styles.active]}><Text style={[styles.label, active && { color: '#FFF' }]}>{section.label}</Text></Pressable>;
    })}
  </View></View>}>
    {mainSections.map(section => <Tabs.Screen key={section.route} name={section.route} options={{ title: section.label }} />)}
    {tools.map(name => <Tabs.Screen key={name} name={name} options={{ href: null }} />)}
  </Tabs></SafeAreaView>;
}
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: '#000' }, dock: { position: 'absolute', left: 0, right: 0, bottom: 12, paddingHorizontal: 18 }, navigation: { flexDirection: 'row', borderWidth: 1, borderColor: '#292929', backgroundColor: '#141414', borderRadius: 999, padding: 6, width: '100%', maxWidth: 440, alignSelf: 'center' }, tab: { flex: 1, minHeight: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 999 }, active: { backgroundColor: '#2C2C2C' }, label: { color: '#8A8A8A', fontSize: 10, letterSpacing: 1, fontWeight: '600' } });
