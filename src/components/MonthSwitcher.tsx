import { StyleSheet, View } from 'react-native';
import { AppText, GhostButton } from '@/components/ui';
import { monthLabel } from '@/lib/format';
import { theme } from '@/theme';

export function MonthSwitcher({
  year,
  month,
  onChange,
}: {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}) {
  function move(delta: number) {
    const next = new Date(Date.UTC(year, month - 1 + delta, 1));
    onChange(next.getUTCFullYear(), next.getUTCMonth() + 1);
  }

  return (
    <View style={styles.row}>
      <GhostButton testID="month-prev" label="Prev" onPress={() => move(-1)} />
      <AppText testID="month-label" numberOfLines={1} style={styles.label}>
        {monthLabel(year, month)}
      </AppText>
      <GhostButton testID="month-next" label="Next" onPress={() => move(1)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    flex: 1,
    textAlign: 'center',
    fontFamily: theme.font.semibold,
    fontSize: 16,
  },
});
