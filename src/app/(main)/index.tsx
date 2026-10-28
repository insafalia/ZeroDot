import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { GlassCard } from '@/components/GlassCard';
import { StatusChips } from '@/components/StatusChips';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { AppText, GhostButton, GoldButton, Notice, PageHeader, Screen } from '@/components/ui';
import { fetchDashboard, fetchMonthVisits, summarizeVisits, updateAppointmentStatus } from '@/lib/api';
import { useSalonLive } from '@/lib/live';
import { clientLabel, formatInr, formatLongDate, formatTimeLabel, greeting, istTodayIso } from '@/lib/format';
import { theme, type AppointmentStatus } from '@/theme';
import type { Appointment, DashboardData } from '@/types';

export default function DashboardScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 768;
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [visits, setVisits] = useState<Appointment[]>([]);
  const [loadedMonth, setLoadedMonth] = useState('');
  const hasData = useRef(false);
  const [todayYear, todayMonth] = istTodayIso().split('-').map(Number);
  const [cursorYear, setCursorYear] = useState(todayYear);
  const [cursorMonth, setCursorMonth] = useState(todayMonth);

  const load = useCallback(async () => {
    const [next, monthVisits] = await Promise.all([fetchDashboard(), fetchMonthVisits(cursorYear, cursorMonth)]);
    hasData.current = true;
    setData(next);
    setVisits(monthVisits);
    setLoadedMonth(`${cursorYear}-${cursorMonth}`);
    setError(null);
  }, [cursorYear, cursorMonth]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!hasData.current) setLoading(true);
      load()
        .catch((err: unknown) => {
          if (active) setError(err instanceof Error ? err.message : 'Could not load the dashboard');
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
      setError(err instanceof Error ? err.message : 'Could not load the dashboard');
    });
  });

  async function refresh() {
    setRefreshing(true);
    try {
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the dashboard');
    } finally {
      setRefreshing(false);
    }
  }

  async function changeStatus(id: string, status: AppointmentStatus) {
    if (!data) return;
    const previous = data;
    setPendingId(id);
    setData({
      ...data,
      agenda: data.agenda.map((item) => (item.id === id ? { ...item, status } : item)),
    });
    try {
      await updateAppointmentStatus(id, status);
      await load();
    } catch (err) {
      setData(previous);
      setError(err instanceof Error ? err.message : 'Could not update the visit');
    } finally {
      setPendingId(null);
    }
  }

  const monthReady = loadedMonth === `${cursorYear}-${cursorMonth}`;
  const summary = summarizeVisits(monthReady ? visits : []);
  const progress =
    !data || data.weeklyTarget <= 0
      ? data && data.weekEarnings > 0
        ? 1
        : 0
      : Math.min(1, data.weekEarnings / data.weeklyTarget);

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <PageHeader
        kicker="ZeroDot"
        title={greeting()}
        subtitle={data ? formatLongDate(data.today) : 'Today in the studio'}
      />
      {error ? <Notice>{error}</Notice> : null}
      {loading && !data ? <ActivityIndicator color={theme.gold} /> : null}
      {data ? (
        <>
          <View style={styles.panel}>
            <View style={[styles.panelHead, !wide && styles.panelHeadStack]}>
              <View style={wide ? styles.switcherWide : undefined}>
                <MonthSwitcher
                  year={cursorYear}
                  month={cursorMonth}
                  onChange={(year, month) => {
                    setCursorYear(year);
                    setCursorMonth(month);
                  }}
                />
              </View>
              <GhostButton
                label="All filters"
                onPress={() =>
                  router.push({
                    pathname: '/reports',
                    params: { year: String(cursorYear), month: String(cursorMonth) },
                  } as unknown as Href)
                }
              />
            </View>
            {monthReady ? null : <ActivityIndicator color={theme.gold} style={{ marginVertical: 12 }} />}
            {monthReady ? (
            <MetricRow wide={wide}>
              <Metric label="Month earnings" value={formatInr(summary.earnings)} detail="Completed visits" wide={wide} />
              <Metric label="Clients" value={String(summary.clients)} detail="Numbers seen this month" wide={wide} />
              <Metric label="Completed" value={String(summary.completed)} detail="Finished visits" wide={wide} />
              <Metric label="Visits" value={String(summary.visits)} detail="Every status this month" wide={wide} />
            </MetricRow>
            ) : null}
            <AppText style={styles.weekLine}>
              This week {formatInr(data.weekEarnings)} of {formatInr(data.weeklyTarget)}
            </AppText>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
          </View>
          <AppText style={styles.section}>Today's agenda</AppText>
          {data.agenda.length === 0 ? (
            <GlassCard>
              <AppText style={styles.empty}>The book is clear today.</AppText>
              <GoldButton label="Book a visit" onPress={() => router.push('/book' as Href)} />
            </GlassCard>
          ) : (
            <View style={{ gap: 12 }}>
              {data.agenda.map((item) => (
                <GlassCard key={item.id} style={item.status === 'cancelled' ? { opacity: 0.62 } : undefined}>
                  <Pressable
                    onPress={() => router.push({ pathname: '/book', params: { id: item.id } } as unknown as Href)}
                    style={styles.agendaTop}>
                    <View style={{ flex: 1 }}>
                      <AppText style={styles.time}>{formatTimeLabel(item.start_time)}</AppText>
                      <AppText style={styles.client}>{clientLabel(item.client)}</AppText>
                      <AppText style={styles.meta}>
                        {item.service_name} · {item.duration_minutes} min
                      </AppText>
                      {item.formula_notes ? (
                        <AppText numberOfLines={2} style={styles.notes}>
                          {item.formula_notes}
                        </AppText>
                      ) : null}
                    </View>
                    <AppText style={styles.price}>{formatInr(item.price_inr)}</AppText>
                  </Pressable>
                  <View style={{ marginTop: 14 }}>
                    <StatusChips
                      value={item.status}
                      disabled={pendingId === item.id}
                      onChange={(status) => changeStatus(item.id, status)}
                    />
                  </View>
                </GlassCard>
              ))}
            </View>
          )}
        </>
      ) : null}
    </Screen>
  );
}

function MetricRow({ wide, children }: { wide: boolean; children: React.ReactNode }) {
  if (wide) return <View style={styles.metrics}>{children}</View>;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.metricScroller}
      contentContainerStyle={styles.metricRail}>
      {children}
    </ScrollView>
  );
}

function Metric({
  label,
  value,
  detail,
  progress,
  wide,
}: {
  label: string;
  value: string;
  detail: string;
  progress?: number;
  wide: boolean;
}) {
  return (
    <View style={[styles.metric, wide ? styles.metricWide : styles.metricPhone]}>
      <GlassCard style={styles.metricCard}>
        <AppText numberOfLines={1} style={styles.metricLabel}>
          {label}
        </AppText>
        <AppText numberOfLines={1} adjustsFontSizeToFit style={styles.metricValue}>
          {value}
        </AppText>
        <AppText numberOfLines={2} style={styles.metricDetail}>
          {detail}
        </AppText>
        <View style={styles.track}>
          {progress !== undefined ? (
            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
          ) : null}
        </View>
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
    marginBottom: 28,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  panelHeadStack: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  switcherWide: {
    flex: 1,
    maxWidth: 420,
  },
  weekLine: {
    color: theme.muted,
    fontSize: 13,
    marginTop: 4,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  metricScroller: {
    marginBottom: 12,
    marginHorizontal: -4,
  },
  metricRail: {
    gap: 12,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  metric: {
    flexGrow: 1,
  },
  metricWide: {
    flexBasis: '22%',
    minWidth: 160,
  },
  metricPhone: {
    width: 176,
  },
  metricCard: {
    flex: 1,
  },
  metricLabel: {
    color: theme.gold,
    fontFamily: theme.font.semibold,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontFamily: theme.font.bold,
    fontSize: 26,
    marginTop: 8,
  },
  metricDetail: {
    color: theme.muted,
    fontSize: 12,
    marginTop: 4,
    minHeight: 32,
  },
  track: {
    height: 4,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 12,
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    borderRadius: 99,
    backgroundColor: theme.gold,
  },
  section: {
    fontFamily: theme.font.semibold,
    fontSize: 18,
    marginBottom: 12,
  },
  empty: {
    color: theme.muted,
    marginBottom: 14,
  },
  agendaTop: {
    flexDirection: 'row',
    gap: 12,
  },
  time: {
    color: theme.gold,
    fontFamily: theme.font.semibold,
  },
  client: {
    fontFamily: theme.font.semibold,
    fontSize: 18,
    marginTop: 4,
  },
  meta: {
    color: theme.muted,
    marginTop: 2,
  },
  notes: {
    color: theme.faint,
    marginTop: 6,
  },
  price: {
    flexShrink: 0,
    color: theme.gold,
    fontFamily: theme.font.semibold,
  },
});
