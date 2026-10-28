import { Children, ReactNode } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type TextInputProps,
  type TextProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { liftFocusedField, useKeyboardInset } from '@/lib/keyboard';
import { theme } from '@/theme';

export function AppText({ style, ...props }: TextProps) {
  return <Text {...props} style={[{ color: theme.text, fontFamily: theme.font.regular }, style]} />;
}

export function PageHeader({
  kicker,
  title,
  subtitle,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
}) {
  const { width } = useWindowDimensions();
  const compact = width < 768;
  return (
    <View style={[styles.header, compact && styles.headerCompact]}>
      {kicker ? <AppText style={styles.kicker}>{kicker}</AppText> : null}
      <AppText style={[styles.title, compact && styles.titleCompact]}>{title}</AppText>
      {subtitle ? <AppText style={[styles.subtitle, compact && styles.subtitleCompact]}>{subtitle}</AppText> : null}
    </View>
  );
}

export function FieldRow({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const stacked = width < 768;
  return (
    <View style={{ flexDirection: stacked ? 'column' : 'row', gap: stacked ? 0 : 12 }}>
      {Children.map(children, (child) => (
        <View style={stacked ? undefined : { flex: 1, minWidth: 0 }}>{child}</View>
      ))}
    </View>
  );
}

export function TextField({
  label,
  hint,
  prefix,
  style,
  onFocus,
  ...input
}: TextInputProps & { label: string; hint?: string; prefix?: string }) {
  return (
    <View style={styles.field}>
      <AppText style={styles.label}>{label}</AppText>
      <View style={styles.inputShell}>
        {prefix ? <AppText style={styles.prefix}>{prefix}</AppText> : null}
        <TextInput
          accessibilityLabel={label}
          {...input}
          onFocus={(event) => {
            onFocus?.(event);
            liftFocusedField(event.target);
          }}
          placeholderTextColor={theme.faint}
          selectionColor={theme.gold}
          style={[styles.input, input.multiline ? styles.multiline : null, style]}
        />
      </View>
      {hint ? <AppText style={styles.hint}>{hint}</AppText> : null}
    </View>
  );
}

export function GoldButton({
  label,
  onPress,
  disabled,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { opacity: disabled ? 0.45 : pressed ? 0.86 : 1 }]}>
      <AppText style={styles.buttonText}>{label}</AppText>
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  tone = 'gold',
  testID,
}: {
  label: string;
  onPress: () => void;
  tone?: 'gold' | 'rose';
  testID?: string;
}) {
  return (
    <Pressable accessibilityRole="button" testID={testID} hitSlop={8} onPress={onPress} style={styles.ghost}>
      <AppText style={[styles.ghostText, { color: tone === 'rose' ? theme.rose : theme.gold }]}>{label}</AppText>
    </Pressable>
  );
}

export function Notice({ children, tone = 'rose' }: { children: string; tone?: 'rose' | 'gold' }) {
  const gold = tone === 'gold';
  return (
    <View style={[styles.notice, { borderColor: gold ? theme.line : 'rgba(244, 63, 94, 0.45)' }]}>
      <AppText style={{ color: gold ? theme.gold : theme.rose }}>{children}</AppText>
    </View>
  );
}

export function Screen({
  children,
  onRefresh,
  refreshing = false,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardInset();
  const { width } = useWindowDimensions();
  const wide = width >= 768;
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: wide ? 28 : insets.top + 12,
          paddingBottom: (wide ? 36 : 24) + insets.bottom + (keyboard > 0 ? 48 : 0),
          paddingHorizontal: wide ? 36 : 16,
        },
      ]}
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.gold} colors={[theme.gold]} />
        ) : undefined
      }>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  content: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
  },
  header: {
    marginBottom: 22,
  },
  headerCompact: {
    marginBottom: 16,
  },
  kicker: {
    color: theme.gold,
    fontFamily: theme.font.semibold,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    fontFamily: theme.font.bold,
    fontSize: 34,
    letterSpacing: -0.8,
  },
  titleCompact: {
    fontSize: 28,
    letterSpacing: -0.4,
  },
  subtitle: {
    color: theme.muted,
    marginTop: 6,
    fontSize: 15,
  },
  subtitleCompact: {
    fontSize: 14,
    lineHeight: 20,
  },
  field: {
    marginBottom: 14,
  },
  label: {
    color: theme.gold,
    fontFamily: theme.font.medium,
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  prefix: {
    fontFamily: theme.font.semibold,
    color: theme.gold,
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: theme.text,
    fontFamily: theme.font.regular,
    fontSize: 16,
    paddingVertical: 12,
    outlineWidth: 0,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  hint: {
    color: theme.faint,
    fontSize: 12,
    marginTop: 6,
  },
  button: {
    backgroundColor: theme.gold,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: theme.ink,
    fontFamily: theme.font.semibold,
    fontSize: 16,
  },
  ghost: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  ghostText: {
    fontFamily: theme.font.semibold,
    fontSize: 14,
  },
  notice: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
});
