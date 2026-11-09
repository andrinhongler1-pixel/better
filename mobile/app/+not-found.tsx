import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../src/theme/tokens';

export default function NotFound() {
  return <View style={styles.screen}><Text style={styles.brand}>better.</Text><Text style={styles.title}>RETURN TO TODAY.</Text><Link href="/" style={styles.link}>BACK TO THE START</Link></View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 32, backgroundColor: colors.background, gap: 32 },
  brand: { color: colors.text, fontSize: 30, fontWeight: '700', letterSpacing: -1.8 },
  title: { color: colors.text, fontSize: 32, fontWeight: '800' },
  link: { color: colors.text, fontSize: 12, letterSpacing: 1.2, padding: 20, backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.line, textAlign: 'center' },
});
