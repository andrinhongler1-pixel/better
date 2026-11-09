import { useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius } from '../theme/tokens';
import { useReducedMotion } from '../hooks/useReducedMotion';

export function OutlineButton({ label, onPress, disabled = false, highlighted = false, dimWhenDisabled = true, testID }: { label: string; onPress: () => void; disabled?: boolean; highlighted?: boolean; dimWhenDisabled?: boolean; testID?: string }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const reducedMotion = useReducedMotion();
  const press = (value: number) => Animated.timing(opacity, { toValue: value, duration: reducedMotion ? 0 : 150, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
  return <Animated.View style={{ opacity }}><Pressable testID={testID} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} onPressIn={() => press(0.82)} onPressOut={() => press(1)}
    style={({ pressed }) => [styles.button, (pressed || highlighted) && styles.pressed, disabled && dimWhenDisabled && styles.disabled]}>
    {({ pressed }) => <Text style={[styles.label, (pressed || highlighted) && { color: colors.background }]}>{label}</Text>}
  </Pressable></Animated.View>;
}
const styles = StyleSheet.create({
  button: { backgroundColor: colors.surface, borderRadius: radius.control, borderWidth: 1, borderColor: '#353535', minHeight: 58, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  pressed: { backgroundColor: colors.text }, disabled: { opacity: 0.45 },
  label: { color: colors.text, fontSize: 11, fontWeight: '600', letterSpacing: 1.6, textAlign: 'center' },
});
