import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { ToolPage, Label, Secondary, ui } from '../../src/components/ToolPage';
import { useSession } from '../../src/features/session/SessionProvider';
export default function Today() {
  const { todayEntrance, finishTodayEntrance } = useSession();
  const [entrance] = useState(todayEntrance);
  const opacity = useRef(new Animated.Value(entrance ? 0 : 1)).current;
  const translateY = useRef(new Animated.Value(entrance && !entrance.reducedMotion ? 8 : 0)).current;
  useEffect(() => {
    if (!entrance) return;
    const animation = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: entrance.reducedMotion ? 120 : 300, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }),
      ...(entrance.reducedMotion ? [] : [Animated.timing(translateY, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' })]),
    ]);
    animation.start(({ finished }) => { if (finished) finishTodayEntrance(entrance.id); });
    return () => { animation.stop(); finishTodayEntrance(entrance.id); };
  }, [entrance, finishTodayEntrance, opacity, translateY]);
  return <Animated.View testID="today-content" style={{ flex: 1, opacity, transform: [{ translateY }] }}><ToolPage title="TODAY"><View style={styles.body}><Label>THE WORK BEGINS</Label><Text style={[ui.heading, styles.hero]}>SHOW{'\n'}UP.</Text><Secondary>You made the first choice.{'\n'}Make the next one count.</Secondary><View style={ui.divider} /><Label>TODAY HAS STARTED</Label><Secondary>One day. Full attention.</Secondary></View></ToolPage></Animated.View>;
}
const styles = StyleSheet.create({ body: { flex: 1, justifyContent: 'center', backgroundColor: '#141414', borderRadius: 20, borderWidth: 1, borderColor: '#292929', padding: 26, gap: 20, minHeight: 420 }, hero: { fontSize: 80, lineHeight: 80, letterSpacing: -4, fontWeight: '700' } });
