import { Slot, router, usePathname, type Href } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/auth';
import { AppText, GoldButton, GhostButton } from '@/components/ui';
import { useKeyboardInset } from '@/lib/keyboard';
import { theme } from '@/theme';

const PHONE_NAV = [
  { href: '/', label: 'Dashboard', short: 'Today', match: (path: string) => path === '/' },
  { href: '/schedule', label: 'Schedule', short: 'Diary', match: (path: string) => path.startsWith('/schedule') },
  { href: '/clients', label: 'Clients', short: 'Clients', match: (path: string) => path.startsWith('/clients') },
  { href: '/settings', label: 'Settings', short: 'Studio', match: (path: string) => path.startsWith('/settings') },
] as const;

const SIDE_NAV = [
  PHONE_NAV[0],
  PHONE_NAV[1],
  PHONE_NAV[2],
  { href: '/reports', label: 'Reports', short: 'Reports', match: (path: string) => path.startsWith('/reports') },
  PHONE_NAV[3],
] as const;

function openNav(href: string) {
  router.replace(href as Href);
}

function openBook() {
  router.push('/book' as Href);
}

export function AppChrome() {
  const { width } = useWindowDimensions();
  const wide = width >= 768;
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const keyboard = useKeyboardInset();
  const leftNav = PHONE_NAV.slice(0, 2);
  const rightNav = PHONE_NAV.slice(2);

  return (
    <View style={[styles.root, { flexDirection: wide ? 'row' : 'column' }]}>
      {wide ? (
        <View style={[styles.sidebar, { paddingTop: Math.max(insets.top, 28) }]}>
          <View>
            <AppText style={styles.wordmark}>ZERODOT</AppText>
            <AppText style={styles.salon}>SALON</AppText>
            <View style={styles.rule} />
            {SIDE_NAV.map((item) => {
              const active = item.match(path);
              return (
                <Pressable
                  key={item.href}
                  accessibilityRole="button"
                  onPress={() => openNav(item.href)}
                  style={[styles.sideItem, active && styles.sideItemActive]}>
                  <AppText style={[styles.sideLabel, { color: active ? theme.gold : theme.muted }]}>
                    {item.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          <View style={{ paddingBottom: Math.max(insets.bottom, 18) }}>
            <GoldButton label="New booking" onPress={openBook} />
            <View style={{ height: 8 }} />
            <GhostButton label="Sign out" onPress={() => signOut()} tone="rose" />
          </View>
        </View>
      ) : null}
      <KeyboardAvoidingView style={styles.body} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Slot />
      </KeyboardAvoidingView>
      {wide || keyboard > 0 ? null : (
        <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          {leftNav.map((item) => (
            <TabButton key={item.href} label={item.short} active={item.match(path)} onPress={() => openNav(item.href)} />
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel="Book" onPress={openBook} style={styles.book}>
            <AppText style={styles.bookText}>+</AppText>
          </Pressable>
          {rightNav.map((item) => (
            <TabButton key={item.href} label={item.short} active={item.match(path)} onPress={() => openNav(item.href)} />
          ))}
        </View>
      )}
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.tab}>
      <View style={[styles.dash, { backgroundColor: active ? theme.gold : 'transparent' }]} />
      <AppText style={[styles.tabLabel, { color: active ? theme.gold : theme.muted }]}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  sidebar: {
    width: 248,
    borderRightWidth: 1,
    borderRightColor: theme.line,
    paddingHorizontal: 18,
    justifyContent: 'space-between',
    backgroundColor: '#121722',
  },
  wordmark: {
    fontFamily: theme.font.bold,
    letterSpacing: 3,
    fontSize: 18,
  },
  salon: {
    color: theme.muted,
    letterSpacing: 2.4,
    fontSize: 11,
    marginTop: 4,
    fontFamily: theme.font.medium,
  },
  rule: {
    width: 36,
    height: 2,
    backgroundColor: theme.rose,
    marginTop: 14,
    marginBottom: 22,
  },
  sideItem: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  sideItemActive: {
    backgroundColor: theme.goldSoft,
  },
  sideLabel: {
    fontFamily: theme.font.semibold,
    fontSize: 15,
  },
  body: {
    flex: 1,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: theme.line,
    backgroundColor: '#121722',
    paddingTop: 8,
    paddingHorizontal: 8,
    overflow: 'visible',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    gap: 5,
  },
  dash: {
    width: 18,
    height: 2,
    borderRadius: 2,
  },
  tabLabel: {
    fontFamily: theme.font.medium,
    fontSize: 12,
  },
  book: {
    width: 52,
    height: 52,
    marginTop: -22,
    borderRadius: 26,
    backgroundColor: theme.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#121722',
  },
  bookText: {
    color: theme.ink,
    fontFamily: theme.font.semibold,
    fontSize: 28,
    lineHeight: 30,
    marginTop: -2,
  },
});
