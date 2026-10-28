import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { GlassCard } from '@/components/GlassCard';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { AppText, GhostButton, Notice, PageHeader, Screen } from '@/components/ui';
import { fetchMonthVisits, fetchServices, summarizeVisits } from '@/lib/api';
import { clientLabel, formatInr, formatLongDate, formatPhone, formatTimeLabel, istTodayIso } from '@/lib/format';
import { useSalonLive } from '@/lib/live';
import { statusMeta, theme, type AppointmentStatus } from '@/theme';
import type { Appointment } from '@/types';

function one(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default function ReportsScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 768;
  const params = useLocalSearchParams<{ year?: string; month?: string }>();
  const [todayYear, todayMonth] = istTodayIso().split('-').map(Number);
  const requestedYear = Number(one(params.year));
  const requestedMonth = Number(one(params.month));
  const [cursorYear, setCursorYear] = useState(requestedYear >= 2000 ? requestedYear : todayYear);
  const [cursorMonth, setCursorMonth] = useState(requestedMonth >= 1 && requestedMonth <= 12 ? requestedMonth : todayMonth);
  const [visits, setVisits] = useState<Appointment[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [status, setStatus] = useState<'all' | AppointmentStatus>('all');
  const [service, setService] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [loadedMonth, setLoadedMonth] = useState('');

  const load = useCallback(async () => {
    const [rows, catalog] = await Promise.all([fetchMonthVisits(cursorYear, cursorMonth), fetchServices()]);
    const names = Array.from(new Set([...catalog.map((item) => item.name), ...rows.map((item) => item.service_name)])).sort((a, b) =>
      a.localeCompare(b),
    );
    setVisits(rows);
    setServices(names);
    setLoadedMonth(`${cursorYear}-${cursorMonth}`);
    setService((current) => (current !== 'all' && !names.includes(current) ? 'all' : current));
    setError(null);
  }, [cursorYear, cursorMonth]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      load()
        .catch((err: unknown) => {
          if (active) setError(err instanceof Error ? err.message : 'Could not load this month');
        });
      return () => {
        active = false;
      };
    }, [load]),
  );

  useSalonLive(() => {
    load().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Could not load this month');
    });
  });

  const monthReady = loadedMonth === `${cursorYear}-${cursorMonth}`;
  const inService = useMemo(
    () => (monthReady ? visits : []).filter((row) => service === 'all' || row.service_name === service),
    [monthReady, visits, service],
  );
  const filtered = useMemo(
    () => (status === 'all' ? inService : inService.filter((row) => row.status === status)),
    [inService, status],
  );
  const summary = summarizeVisits(filtered);
  const statusCounts = summarizeVisits(inService);
  const people = useMemo(() => {
    const map = new Map<string, { id: string; label: string; phone: string; spent: number; visits: number }>();
    for (const row of filtered) {
      const current = map.get(row.client_id) ?? {
        id: row.client_id,
        label: clientLabel(row.client),
        phone: row.client?.phone ?? '',
        spent: 0,
        visits: 0,
      };
      current.visits += 1;
      if (row.status === 'completed') current.spent += row.price_inr;
      map.set(row.client_id, current);
    }
    return Array.from(map.values()).sort((a, b) => b.spent - a.spent || a.label.localeCompare(b.label));
  }, [filtered]);

  const statusFilters: { id: 'all' | AppointmentStatus; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: inService.length },
    { id: 'confirmed', label: statusMeta.confirmed.label, count: statusCounts.confirmed },
    { id: 'in_progress', label: statusMeta.in_progress.label, count: statusCounts.inProgress },
    { id: 'completed', label: statusMeta.completed.label, count: statusCounts.completed },
    { id: 'no_show', label: statusMeta.no_show.label, count: statusCounts.noShow },
    { id: 'cancelled', label: statusMeta.cancelled.label, count: statusCounts.cancelled },
  ];

  return (
    <Screen>
      {wide ? null : <GhostButton label="Back to today" onPress={() => router.replace('/' as Href)} />}
      <PageHeader
        kicker="Studio"
        title="Reports"
        subtitle="Choose a month, then narrow by status or service. Earnings count finished visits only."
      />
      {error ? <Notice>{error}</Notice> : null}
      <View style={styles.panel}>
        <MonthSwitcher
          year={cursorYear}
          month={cursorMonth}
          onChange={(year, month) => {
            setCursorYear(year);
            setCursorMonth(month);
          }}
        />
        <AppText style={styles.filterLabel}>Status</AppText>
        <View style={styles.chips}>
          {statusFilters.map((item) => (
            <FilterChip
              key={item.id}
              testID={`filter-status-${item.id}`}
              label={`${item.label} ${item.count}`}
              selected={status === item.id}
              onPress={() => setStatus(item.id)}
            />
          ))}
        </View>
        <AppText style={styles.filterLabel}>Service</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.serviceChips}>
          <FilterChip testID="filter-service-all" label="All services" selected={service === 'all'} onPress={() => setService('all')} />
          {services.map((name) => (
            <FilterChip
              key={name}
              testID={`filter-service-${name}`}
              label={name}
              selected={service === name}
              onPress={() => setService(name)}
            />
          ))}
        </ScrollView>
      </View>

      {monthReady ? null : <ActivityIndicator color={theme.gold} style={{ marginBottom: 16 }} />}

      <View style={wide ? styles.stats : undefined}>
        {wide ? null : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statRail}>
            <Stat label="Earnings" value={formatInr(summary.earnings)} detail="Completed in this view" phone />
            <Stat label="Clients" value={String(summary.clients)} detail="Numbers in this view" phone />
            <Stat label="Completed" value={String(summary.completed)} detail="Finished visits" phone />
            <Stat label="Visits" value={String(summary.visits)} detail="Matching the filters" phone />
          </ScrollView>
        )}
        {wide ? (
          <>
            <Stat label="Earnings" value={formatInr(summary.earnings)} detail="Completed in this view" />
            <Stat label="Clients" value={String(summary.clients)} detail="Numbers in this view" />
            <Stat label="Completed" value={String(summary.completed)} detail="Finished visits" />
            <Stat label="Visits" value={String(summary.visits)} detail="Matching the filters" />
          </>
        ) : null}
      </View>

      <AppText style={styles.section}>Clients</AppText>
      {people.length === 0 ? (
        <AppText style={styles.quiet}>No clients match these filters.</AppText>
      ) : (
        <View style={styles.people}>
          {people.map((person) => (
            <Pressable key={person.id} onPress={() => router.push(`/clients/${person.id}` as Href)} style={styles.person}>
              <AppText style={styles.personName}>{person.label}</AppText>
              {person.phone && person.label !== formatPhone(person.phone) ? (
                <AppText style={styles.quiet}>{formatPhone(person.phone)}</AppText>
              ) : null}
              <AppText style={styles.quiet}>
                {formatInr(person.spent)} · {person.visits} {person.visits === 1 ? 'visit' : 'visits'}
              </AppText>
            </Pressable>
          ))}
        </View>
      )}

      <AppText style={styles.section}>Visits</AppText>
      {filtered.length === 0 ? (
        <AppText style={styles.quiet}>No visits match these filters.</AppText>
      ) : (
        <View style={{ gap: 10 }}>
          {filtered.map((item) => (
            <Pressable key={item.id} onPress={() => router.push({ pathname: '/book', params: { id: item.id } } as unknown as Href)}>
              <GlassCard style={item.status === 'cancelled' ? { opacity: 0.62 } : undefined}>
                <View style={styles.visitTop}>
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.time}>
                      {formatLongDate(item.appointment_date)} · {formatTimeLabel(item.start_time)}
                    </AppText>
                    <AppText style={styles.personName}>{clientLabel(item.client)}</AppText>
                    <AppText style={styles.quiet}>
                      {item.service_name} · {item.duration_minutes} min · {statusMeta[item.status].label}
                    </AppText>
                  </View>
                  <AppText style={styles.price}>{formatInr(item.price_inr)}</AppText>
                </View>
              </GlassCard>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipOn]}>
      <AppText style={{ color: selected ? theme.ink : theme.text, fontFamily: theme.font.semibold }}>{label}</AppText>
    </Pressable>
  );
}

function Stat({ label, value, detail, phone }: { label: string; value: string; detail: string; phone?: boolean }) {
  return (
    <View style={phone ? styles.statPhone : styles.stat}>
      <GlassCard>
        <AppText numberOfLines={1} style={styles.statLabel}>
          {label}
        </AppText>
        <AppText numberOfLines={1} adjustsFontSizeToFit style={styles.statValue}>
          {value}
        </AppText>
        <AppText numberOfLines={2} style={styles.statDetail}>
          {detail}
        </AppText>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 22,
    padding: 14,
    marginBottom: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  filterLabel: {
    color: theme.gold,
    fontFamily: theme.font.medium,
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  serviceChips: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipOn: {
    backgroundColor: theme.gold,
    borderColor: theme.gold,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  stat: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 150,
  },
  statRail: {
    gap: 12,
    paddingBottom: 8,
  },
  statPhone: {
    width: 176,
  },
  statLabel: {
    color: theme.gold,
    fontFamily: theme.font.semibold,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  statValue: {
    fontFamily: theme.font.bold,
    fontSize: 26,
    marginTop: 8,
  },
  statDetail: {
    color: theme.muted,
    fontSize: 12,
    marginTop: 4,
    minHeight: 32,
  },
  section: {
    fontFamily: theme.font.semibold,
    fontSize: 18,
    marginTop: 18,
    marginBottom: 12,
  },
  quiet: {
    color: theme.muted,
  },
  people: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  person: {
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minWidth: 160,
  },
  personName: {
    fontFamily: theme.font.semibold,
    fontSize: 16,
  },
  visitTop: {
    flexDirection: 'row',
    gap: 12,
  },
  time: {
    color: theme.gold,
    fontFamily: theme.font.semibold,
  },
  price: {
    flexShrink: 0,
    color: theme.gold,
    fontFamily: theme.font.semibold,
  },
});
