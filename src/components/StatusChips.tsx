import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { AppText } from '@/components/ui';
import { statusMeta, statusOrder, theme, type AppointmentStatus } from '@/theme';

export function StatusChips({
  value,
  onChange,
  disabled,
}: {
  value: AppointmentStatus;
  onChange: (status: AppointmentStatus) => void;
  disabled?: boolean;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {statusOrder.map((status) => {
        const meta = statusMeta[status];
        const selected = status === value;
        return (
          <Pressable
            key={status}
            accessibilityRole="button"
            accessibilityLabel={meta.label}
            accessibilityState={{ selected }}
            disabled={disabled}
            onPress={() => onChange(status)}
            style={[
              styles.chip,
              {
                backgroundColor: selected ? meta.color : 'transparent',
                borderColor: selected ? meta.color : 'rgba(255,255,255,0.14)',
                opacity: disabled ? 0.6 : 1,
              },
            ]}>
            <AppText style={[styles.label, { color: selected ? theme.ink : theme.muted }]}>{meta.label}</AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: theme.font.medium,
    fontSize: 12,
  },
});
