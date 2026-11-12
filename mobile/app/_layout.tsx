import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from '../src/features/session/SessionProvider';
import { QuitProvider } from '../src/features/quit/QuitProvider';
import { SleepProvider } from '../src/features/sleep/SleepProvider';
import { RunProvider } from '../src/features/running/RunProvider';
import { PlannerProvider } from '../src/features/planner/PlannerProvider';
export default function Layout() {
  return <SafeAreaProvider><SleepProvider><SessionProvider><RunProvider><PlannerProvider><QuitProvider><StatusBar style="light" backgroundColor="#000000" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000000' }, animation: 'none' }} /></QuitProvider></PlannerProvider></RunProvider></SessionProvider></SleepProvider></SafeAreaProvider>;
}
