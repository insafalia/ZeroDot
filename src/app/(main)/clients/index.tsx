import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { GlassCard } from '@/components/GlassCard';
import { AppText, Notice, PageHeader, Screen, TextField } from '@/components/ui';
import { fetchClientDirectory } from '@/lib/api';
import { useSalonLive } from '@/lib/live';
import { clientLabel, formatInr, formatPhone } from '@/lib/format';
import { theme } from '@/theme';
import type { ClientSummary } from '@/types';

export default function ClientsScreen() {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(handle);
  }, [query]);

  const load = useCallback(async () => {
    const rows = await fetchClientDirectory(debounced);
    setClients(rows);
    setError(null);
  }, [debounced]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      load()
        .catch((err: unknown) => {
          if (active) setError(err instanceof Error ? err.message : 'Could not load clients');
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
      setError(err instanceof Error ? err.message : 'Could not load clients');
    });
  });

  return (
    <Screen>
      <PageHeader kicker="Book" title="Clients" subtitle="Search by name or mobile. A number with no name still shows the number." />
      <TextField label="Search" value={query} onChangeText={setQuery} placeholder="Name or mobile" />
      {error ? <Notice>{error}</Notice> : null}
      {loading ? <ActivityIndicator color={theme.gold} /> : null}
      {!loading && clients.length === 0 ? (
        <AppText style={styles.quiet}>
          {debounced ? 'No clients match that search.' : 'No clients yet. A booking with a mobile number starts the book.'}
        </AppText>
      ) : (
        <View style={{ gap: 10 }}>
          {clients.map((client) => (
            <Pressable key={client.id} onPress={() => router.push(`/clients/${client.id}` as Href)}>
              <GlassCard>
                <AppText style={styles.name}>{clientLabel(client)}</AppText>
                {client.name ? <AppText style={styles.phone}>{formatPhone(client.phone)}</AppText> : null}
                <AppText style={styles.meta}>
                  {formatInr(client.spent)} spent · {client.visits} {client.visits === 1 ? 'visit' : 'visits'}
                </AppText>
              </GlassCard>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  quiet: {
    color: theme.muted,
  },
  name: {
    fontFamily: theme.font.semibold,
    fontSize: 18,
  },
  phone: {
    color: theme.muted,
    marginTop: 4,
  },
  meta: {
    color: theme.gold,
    marginTop: 8,
    fontFamily: theme.font.medium,
  },
});
