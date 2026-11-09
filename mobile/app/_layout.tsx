import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from '../src/features/session/SessionProvider';
import { QuitProvider } from '../src/features/quit/QuitProvider';
import { SleepProvider } from '../src/features/sleep/SleepProvider';
export default function Layout() {
  return <SafeAreaProvider><SleepProvider><SessionProvider><QuitProvider><StatusBar style="light" backgroundColor="#000000" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000000' }, animation: 'none' }} /></QuitProvider></SessionProvider></SleepProvider></SafeAreaProvider>;
}
