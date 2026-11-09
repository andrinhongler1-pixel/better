import { Redirect, Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../src/features/session/SessionProvider';
import { colors } from '../../src/theme/tokens';
import { useSleep } from '../../src/features/sleep/SleepProvider';
const tabs = ['today', 'goals', 'quit', 'trading', 'nutrition', 'sleep'] as const;
export default function MainLayout() {
  const { unlocked } = useSession();
  const { data, status } = useSleep();
  if (!unlocked || data.active || status === 'loading') return <Redirect href="/" />;
  return <SafeAreaView style={styles.screen}>
    <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
      tabBar={({ state, navigation }) => <View style={styles.dock} pointerEvents="box-none"><View style={styles.navigation} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          if (route.name === 'progress') return null;
          const active = state.index === index;
          return <Pressable key={route.key} accessibilityRole="tab" accessibilityState={{ selected: active }} aria-selected={active}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!event.defaultPrevented) navigation.navigate(route.name, route.name === 'quit' ? { screen: 'index' } : undefined);
            }} style={[styles.tab, active && styles.active]}>
            <Text style={[styles.label, route.name === 'nutrition' && { fontSize: 7.5, letterSpacing: 0.1 }, active && { color: colors.text }]}>{route.name.toUpperCase()}</Text>
          </Pressable>;
        })}
      </View></View>}>
      {tabs.map(tab => <Tabs.Screen key={tab} name={tab} options={{ title: tab.toUpperCase() }} />)}
      <Tabs.Screen name="progress" options={{ href: null }} />
    </Tabs>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { flex: 1 },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 12, paddingHorizontal: 16 },
  navigation: { flexDirection: 'row', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: 999, padding: 7, width: '100%', maxWidth: 488, alignSelf: 'center', shadowColor: '#000000', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  active: { backgroundColor: '#2C2C2C' }, label: { color: colors.muted, fontSize: 9, fontWeight: '600', letterSpacing: 0.4 },
});
