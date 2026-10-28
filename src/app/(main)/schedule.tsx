import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { GlassCard } from '@/components/GlassCard';
import { AppText, GhostButton, Notice, PageHeader, Screen } from '@/components/ui';
import { fetchAppointmentsBetween, fetchSettings } from '@/lib/api';
import { useSalonLive } from '@/lib/live';
import {
  buildSlots,
  clientLabel,
  formatInr,
  formatLongDate,
  formatTimeLabel,
  isBlockingStatus,
  istTodayIso,
  monthLabel,
  monthBounds,
  monthWeeks,
  rangesOverlap,
} from '@/lib/format';
import { theme } from '@/theme';
import type { Appointment, SalonSettings } from '@/types';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function ScheduleScreen() {
  const today = istTodayIso();
  const [year, month] = today.split('-').map(Number);
  const [cursorYear, setCursorYear] = useState(year);
  const [cursorMonth, setCursorMonth] = useState(month);
  const [selected, setSelected] = useState(today);
  const [settings, setSettings] = useState<SalonSettings | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const bounds = monthBounds(cursorYear, cursorMonth);
    const [salon, rows] = await Promise.all([
      fetchSettings(),
      fetchAppointmentsBetween(bounds.start, bounds.end),
    ]);
    setSettings(salon);
    setAppointments(rows);
    setError(null);
  }, [cursorYear, cursorMonth]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      load()
        .catch((err: unknown) => {
          if (active) setError(err instanceof Error ? err.message : 'Could not load the schedule');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [load]),
  );

  useSalonLive(() => {
    load().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Could not load the schedule');
    });
  });

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of appointments) map.set(row.appointment_date, (map.get(row.appointment_date) ?? 0) + 1);
    return map;
  }, [appointments]);

  const dayRows = appointments.filter((row) => row.appointment_date === selected);
  const slots = settings ? buildSlots(settings.open_time, settings.close_time, settings.slot_minutes) : [];
  const weeks = monthWeeks(cursorYear, cursorMonth);

  function moveMonth(delta: number) {
    const next = new Date(Date.UTC(cursorYear, cursorMonth - 1 + delta, 1));
    const nextYear = next.getUTCFullYear();
    const nextMonth = next.getUTCMonth() + 1;
    setCursorYear(nextYear);
    setCursorMonth(nextMonth);
    const [todayYear, todayMonth] = today.split('-').map(Number);
    if (todayYear === nextYear && todayMonth === nextMonth) setSelected(today);
    else setSelected(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01`);
  }

  return (
    <Screen>
      <PageHeader kicker="Diary" title="Schedule" subtitle="Pick a day, then a chair time." />
      {error ? <Notice>{error}</Notice> : null}
      <GlassCard>
        <View style={styles.monthRow}>
          <GhostButton label="Prev" onPress={() => moveMonth(-1)} />
          <AppText style={styles.month}>{monthLabel(cursorYear, cursorMonth)}</AppText>
          <GhostButton label="Next" onPress={() => moveMonth(1)} />
        </View>
        <View style={styles.weekdays}>
          {WEEKDAYS.map((label, index) => (
            <AppText key={`${label}-${index}`} style={styles.weekday}>
              {label}
            </AppText>
          ))}
        </View>
        {weeks.map((week, weekIndex) => (
          <View key={weekIndex} style={styles.week}>
            {week.map((iso, dayIndex) =>
              iso ? (
                <Pressable
                  key={iso}
                  onPress={() => setSelected(iso)}
                  style={[
                    styles.day,
                    iso === selected && styles.daySelected,
                    iso === today && iso !== selected && styles.dayToday,
                  ]}>
                  <AppText style={[styles.dayText, iso === selected && { color: theme.ink }]}>
                    {Number(iso.slice(-2))}
                  </AppText>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: (counts.get(iso) ?? 0) > 0 ? (iso === selected ? theme.ink : theme.gold) : 'transparent' },
                    ]}
                  />
                </Pressable>
              ) : (
                <View key={`empty-${weekIndex}-${dayIndex}`} style={styles.day} />
              ),
            )}
          </View>
        ))}
      </GlassCard>

      <AppText style={styles.section}>{formatLongDate(selected)}</AppText>
      {loading ? <ActivityIndicator color={theme.gold} /> : null}
      {dayRows.length === 0 ? (
        <AppText style={styles.quiet}>No visits on this day.</AppText>
      ) : (
        <View style={{ gap: 10, marginBottom: 8 }}>
          {dayRows.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => router.push({ pathname: '/book', params: { id: item.id } } as unknown as Href)}>
              <GlassCard>
                <View style={styles.visit}>
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.time}>{formatTimeLabel(item.start_time)}</AppText>
                    <AppText style={styles.client}>{clientLabel(item.client)}</AppText>
                    <AppText style={styles.meta}>
                      {item.service_name} · {item.duration_minutes} min · {item.status.replace('_', ' ')}
                    </AppText>
                  </View>
                  <AppText style={styles.price}>{formatInr(item.price_inr)}</AppText>
                </View>
              </GlassCard>
            </Pressable>
          ))}
        </View>
      )}

      <AppText style={styles.section}>Open slots</AppText>
      {settings && slots.length === 0 ? (
        <AppText style={styles.meta}>This interval is longer than the open hours. Use a shorter slot in Studio.</AppText>
      ) : null}
      <View style={styles.slots}>
        {slots.map((slot) => {
          const overlap = dayRows.find(
            (item) => isBlockingStatus(item.status) && rangesOverlap(slot, settings?.slot_minutes ?? 30, item.start_time, item.duration_minutes),
          );
          return (
            <Pressable
              key={slot}
              onPress={() => {
                if (overlap) {
                  router.push({ pathname: '/book', params: { id: overlap.id } } as unknown as Href);
                  return;
                }
                router.push({ pathname: '/book', params: { date: selected, time: slot } } as unknown as Href);
              }}
              style={[styles.slot, overlap ? styles.slotBusy : styles.slotFree]}>
              <AppText style={{ color: overlap ? theme.rose : theme.text, fontFamily: theme.font.medium }}>
                {formatTimeLabel(slot)}
              </AppText>
              <AppText style={styles.slotMeta} numberOfLines={1}>
                {overlap ? clientLabel(overlap.client) : 'Open'}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  month: {
    fontFamily: theme.font.semibold,
    fontSize: 18,
  },
  weekdays: {
    flexDirection: 'row',
    marginTop: 8,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    color: theme.faint,
    fontSize: 12,
    fontFamily: theme.font.medium,
  },
  week: {
    flexDirection: 'row',
  },
  day: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    marginVertical: 2,
  },
  daySelected: {
    backgroundColor: theme.gold,
  },
  dayToday: {
    borderWidth: 1,
    borderColor: theme.gold,
  },
  dayText: {
    fontFamily: theme.font.medium,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
  },
  section: {
    fontFamily: theme.font.semibold,
    fontSize: 18,
    marginTop: 22,
    marginBottom: 12,
  },
  quiet: {
    color: theme.muted,
  },
  visit: {
    flexDirection: 'row',
    gap: 12,
  },
  time: {
    color: theme.gold,
    fontFamily: theme.font.semibold,
  },
  client: {
    fontFamily: theme.font.semibold,
    fontSize: 16,
    marginTop: 2,
  },
  meta: {
    color: theme.muted,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  price: {
    color: theme.gold,
    fontFamily: theme.font.semibold,
  },
  slots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slot: {
    minWidth: 104,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  slotFree: {
    borderColor: theme.line,
  },
  slotBusy: {
    borderColor: 'rgba(244, 63, 94, 0.45)',
    backgroundColor: theme.roseSoft,
  },
  slotMeta: {
    color: theme.muted,
    fontSize: 12,
    marginTop: 2,
  },
});
