import { useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius } from '../theme/tokens';
import { useReducedMotion } from '../hooks/useReducedMotion';
const buttonText: Record<string, string> = { 'BACK TO JOURNAL': 'Zum Journal', 'GO TO SLEEP': 'Schlafen gehen', 'NOT NOW · OPEN APP': 'App öffnen', 'START YOUR DAY': 'Tag starten', 'SAVE TRADE': 'Trade speichern', '+ ADD TRADE': 'Trade eintragen', 'EDIT TRADE': 'Bearbeiten', 'DELETE TRADE': 'Trade löschen', 'BACK TO SLEEP': 'Zur Schlafübersicht', 'BACK TO RUNNING': 'Zur Laufübersicht', 'START RUN': 'Lauf starten', 'RESUME RUN': 'Fortsetzen', 'PAUSE RUN': 'Pausieren', 'FINISH & SAVE RUN': 'Lauf speichern', 'SCAN FOOD': 'Essen scannen', 'SAVED FOODS': 'Gespeicherte Lebensmittel', 'IMPORT DAILY P&L': 'CSV importieren', 'PREVIEW IMPORT': 'Import prüfen', 'IMPORT TO THIS DEVICE': 'Importieren', 'CANCEL': 'Abbrechen', 'CANCEL EDIT': 'Abbrechen', 'CORRECT TIMES': 'Zeiten korrigieren', 'SAVE CORRECTION': 'Korrektur speichern', 'CHANGE SLEEP GOAL': 'Schlafziel ändern', 'SAVE SLEEP GOAL': 'Schlafziel speichern', 'CANCEL GOAL': 'Abbrechen', 'RETRY': 'Erneut versuchen', 'DELETE RUN': 'Lauf löschen', 'DELETE SESSION': 'Schlafzeit löschen', 'KEEP RUN': 'Lauf behalten', 'KEEP SESSION': 'Schlafzeit behalten', '+ NEW TIMER': 'Timer hinzufügen', 'CANCEL GPS SEARCH': 'GPS-Suche abbrechen' };

export function OutlineButton({ label, onPress, disabled = false, highlighted = false, dimWhenDisabled = true, testID, primary = false }: { label: string; onPress: () => void; disabled?: boolean; highlighted?: boolean; dimWhenDisabled?: boolean; testID?: string; primary?: boolean }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const reducedMotion = useReducedMotion();
  const press = (value: number) => Animated.timing(opacity, { toValue: value, duration: reducedMotion ? 0 : 150, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
  return <Animated.View style={{ opacity }}><Pressable testID={testID} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} onPressIn={() => press(0.82)} onPressOut={() => press(1)}
    style={({ pressed }) => [styles.button, (primary || pressed || highlighted) && styles.pressed, disabled && dimWhenDisabled && styles.disabled]}>
    {({ pressed }) => <Text style={[styles.label, (primary || pressed || highlighted) && { color: colors.background }]}>{buttonText[label] || label}</Text>}
  </Pressable></Animated.View>;
}
const styles = StyleSheet.create({
  button: { backgroundColor: colors.surface, borderRadius: radius.control, borderWidth: 1, borderColor: '#353535', minHeight: 58, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  pressed: { backgroundColor: colors.text }, disabled: { opacity: 0.45 },
  label: { color: colors.text, fontSize: 11, fontWeight: '600', letterSpacing: 1.6, textAlign: 'center' },
});
