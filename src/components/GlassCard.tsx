import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { theme } from '@/theme';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
};

export function GlassCard({ children, style, padded = true }: Props) {
  const inner = <View style={padded ? styles.pad : undefined}>{children}</View>;
  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={32} tint="dark" style={[styles.shell, style]}>
        {inner}
      </BlurView>
    );
  }
  const webGlass = {
    backgroundColor: 'rgba(20, 24, 34, 0.72)',
    backdropFilter: 'blur(18px)',
  } as ViewStyle;
  return <View style={[styles.shell, Platform.OS === 'web' ? webGlass : styles.android, style]}>{inner}</View>;
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.line,
    overflow: 'hidden',
  },
  pad: {
    padding: 16,
  },
  android: {
    backgroundColor: 'rgba(23, 28, 39, 0.94)',
  },
});
