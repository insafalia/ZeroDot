import { StyleSheet, View } from 'react-native';
import { theme } from '@/theme';

/** Vertical urgency dots for past slots that are still open. */
export function OverdueDots() {
  return (
    <View accessibilityLabel="Running out of time" style={styles.wrap}>
      <View style={[styles.dot, styles.dotStrong]} />
      <View style={[styles.dot, styles.dotMid]} />
      <View style={[styles.dot, styles.dotSoft]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
    minHeight: 36,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotStrong: {
    backgroundColor: theme.rose,
  },
  dotMid: {
    backgroundColor: 'rgba(244, 63, 94, 0.7)',
  },
  dotSoft: {
    backgroundColor: 'rgba(244, 63, 94, 0.4)',
  },
});
