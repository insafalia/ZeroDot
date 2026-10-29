import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, GhostButton, GoldButton, Notice, PageHeader, Screen, TextField } from '@/components/ui';
import { upsertClient } from '@/lib/api';
import { normalizePhone } from '@/lib/format';
import { theme } from '@/theme';

export default function NewClientScreen() {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/clients' as Href);
  }

  async function save() {
    const nextPhone = normalizePhone(phone);
    if (!nextPhone) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const client = await upsertClient(nextPhone, name);
      router.replace(`/clients/${client.id}` as Href);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the client');
      setSaving(false);
    }
  }

  return (
    <Screen>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <PageHeader
            kicker="Clients"
            title="New client"
            subtitle="Save a number to the book without booking a visit."
          />
        </View>
        <GhostButton label="Close" onPress={close} />
      </View>
      {error ? <Notice>{error}</Notice> : null}
      <TextField
        testID="client-phone"
        label="Mobile"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder="98765 43210"
        hint="Required, and unique. The same number always belongs to the same client."
      />
      <TextField
        testID="client-name"
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="Optional"
        hint="Optional. If it is empty, the number is what you will see."
      />
      <AppText style={styles.note}>If this mobile is already saved, we open that client and update the name when you enter one.</AppText>
      <GoldButton testID="save-client" label={saving ? 'Saving' : 'Save client'} onPress={save} disabled={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  note: {
    color: theme.muted,
    fontSize: 13,
    marginBottom: 18,
    marginTop: -4,
  },
});
