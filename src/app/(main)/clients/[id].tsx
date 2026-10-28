import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { GlassCard } from '@/components/GlassCard';
import { AppText, GhostButton, Notice, PageHeader, Screen } from '@/components/ui';
import { fetchClientDetail } from '@/lib/api';
import { useSalonLive } from '@/lib/live';
import { clientLabel, formatInr, formatLongDate, formatPhone, formatTimeLabel } from '@/lib/format';
import { statusMeta, theme } from '@/theme';
import type { Appointment, Client } from '@/types';

function one(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default function ClientDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = one(params.id);
  const [client, setClient] = useState<Client | null>(null);
  const [history, setHistory] = useState<Appointment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const detail = await fetchClientDetail(id);
    if (!detail) {
      setError('That client could not be found.');
      setClient(null);
      setHistory([]);
      return;
    }
    setClient(detail.client);
    setHistory(detail.history);
    setError(null);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      load()
        .catch((err: unknown) => {
          if (active) setError(err instanceof Error ? err.message : 'Could not load this client');
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
      setError(err instanceof Error ? err.message : 'Could not load this client');
    });
  });

  const spent = history.filter((item) => item.status === 'completed').reduce((sum, item) => sum + item.price_inr, 0);

  return (
    <Screen>
      <GhostButton label="Back to clients" onPress={() => router.replace('/clients' as Href)} />
      {error ? <Notice>{error}</Notice> : null}
      {loading ? <ActivityIndicator color={theme.gold} /> : null}
      {client ? (
        <>
          <PageHeader
            kicker="Client"
            title={clientLabel(client)}
            subtitle={client.name ? formatPhone(client.phone) : 'Saved by mobile number'}
          />
          <GlassCard>
            <AppText style={styles.spentLabel}>Total spent</AppText>
            <AppText style={styles.spent}>{formatInr(spent)}</AppText>
            <AppText style={styles.note}>Completed visits only. Cancelled and no-show visits stay in the history.</AppText>
          </GlassCard>
          <AppText style={styles.section}>Booking history</AppText>
          {history.length === 0 ? <AppText style={styles.quiet}>No visits yet.</AppText> : null}
          <View style={{ gap: 10 }}>
            {history.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => router.push({ pathname: '/book', params: { id: item.id } } as unknown as Href)}>
                <GlassCard>
                  <AppText style={styles.date}>{formatLongDate(item.appointment_date)}</AppText>
                  <AppText style={styles.service}>
                    {formatTimeLabel(item.start_time)} · {item.service_name}
                  </AppText>
                  <AppText style={styles.meta}>
                    {formatInr(item.price_inr)} · {statusMeta[item.status].label}
                  </AppText>
                  {item.formula_notes ? <AppText style={styles.notes}>{item.formula_notes}</AppText> : null}
                </GlassCard>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  spentLabel: {
    color: theme.gold,
    fontFamily: theme.font.semibold,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  spent: {
    fontFamily: theme.font.bold,
    fontSize: 32,
    marginTop: 6,
  },
  note: {
    color: theme.muted,
    marginTop: 6,
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
  date: {
    fontFamily: theme.font.semibold,
  },
  service: {
    color: theme.muted,
    marginTop: 4,
  },
  meta: {
    color: theme.gold,
    marginTop: 6,
    fontFamily: theme.font.medium,
  },
  notes: {
    color: theme.faint,
    marginTop: 6,
  },
});
