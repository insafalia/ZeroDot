import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useAuth } from '@/auth';
import { GlassCard } from '@/components/GlassCard';
import { AppText, FieldRow, GhostButton, GoldButton, Notice, PageHeader, Screen, TextField } from '@/components/ui';
import { createService, deleteService, fetchServices, fetchSettings, saveSalonSetup, updateService } from '@/lib/api';
import { formatAmountInput, isTimeValue, normalizeTime, parseDuration, parseMoney, parseSlotMinutes } from '@/lib/format';
import { useSalonLive } from '@/lib/live';
import { theme } from '@/theme';
import type { Service } from '@/types';

type ServiceDraft = {
  id: string;
  name: string;
  duration: string;
  price: string;
  confirmDelete: boolean;
};

type ServicePlain = { id: string; name: string; duration: string; price: string };

const QUICK_SLOTS = [10, 15, 20, 30, 45, 60];

function toDraft(service: Service): ServiceDraft {
  return {
    id: service.id,
    name: service.name,
    duration: String(service.duration_minutes),
    price: formatAmountInput(service.price_inr),
    confirmDelete: false,
  };
}

function plain(rows: Array<ServiceDraft | ServicePlain>): ServicePlain[] {
  return rows.map(({ id, name, duration, price }) => ({ id, name, duration, price }));
}

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const [target, setTarget] = useState('25000');
  const [openTime, setOpenTime] = useState('10:00');
  const [closeTime, setCloseTime] = useState('20:00');
  const [slotMinutes, setSlotMinutes] = useState('30');
  const [services, setServices] = useState<ServiceDraft[]>([]);
  const [newName, setNewName] = useState('');
  const [newDuration, setNewDuration] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingStudio, setSavingStudio] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const studioDirty = useRef(false);
  const menuDirty = useRef(false);
  const addDirty = useRef(false);
  const baseline = useRef<ServicePlain[]>([]);
  const servicesRef = useRef<ServiceDraft[]>([]);

  function commitServices(next: ServiceDraft[]) {
    servicesRef.current = next;
    menuDirty.current =
      next.some((item) => item.confirmDelete) || JSON.stringify(plain(next)) !== JSON.stringify(baseline.current);
    setServices(next);
  }

  const load = useCallback(async () => {
    const [salon, rows] = await Promise.all([fetchSettings(), fetchServices()]);
    if (studioDirty.current || menuDirty.current || addDirty.current) return;
    setTarget(formatAmountInput(salon.weekly_target_inr));
    setOpenTime(salon.open_time.slice(0, 5));
    setCloseTime(salon.close_time.slice(0, 5));
    setSlotMinutes(String(salon.slot_minutes));
    const drafts = rows.map(toDraft);
    baseline.current = plain(drafts);
    servicesRef.current = drafts;
    menuDirty.current = false;
    setServices(drafts);
    setError(null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!studioDirty.current && !menuDirty.current && !addDirty.current) setLoading(true);
      load()
        .catch((err: unknown) => {
          if (active) setError(err instanceof Error ? err.message : 'Could not load settings');
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
    if (studioDirty.current || menuDirty.current || addDirty.current) return;
    load().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Could not load settings');
    });
  });

  function markStudio(update: () => void) {
    studioDirty.current = true;
    setNotice(null);
    update();
  }

  function editService(id: string, patch: Partial<ServiceDraft>) {
    commitServices(servicesRef.current.map((item) => (item.id === id ? { ...item, ...patch, confirmDelete: false } : item)));
    setNotice(null);
  }

  async function saveStudio() {
    const weeklyTarget = parseMoney(target);
    const open = openTime.trim();
    const close = closeTime.trim();
    const minutes = parseSlotMinutes(slotMinutes);
    if (weeklyTarget === null) {
      setError('Enter a weekly target in rupees.');
      return;
    }
    if (!isTimeValue(open) || !isTimeValue(close)) {
      setError('Use opening and closing times like 10:00 and 20:00.');
      return;
    }
    if (normalizeTime(open) >= normalizeTime(close)) {
      setError('Closing time has to be after opening time.');
      return;
    }
    if (minutes === null) {
      setError('Enter a slot interval from 5 to 180 minutes.');
      return;
    }
    setSavingStudio(true);
    setError(null);
    try {
      await saveSalonSetup({
        weeklyTarget,
        openTime: normalizeTime(open),
        closeTime: normalizeTime(close),
        slotMinutes: minutes,
      });
      studioDirty.current = false;
      setSlotMinutes(String(minutes));
      setNotice('Saved. The diary is using these hours and this slot interval.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save settings');
    } finally {
      setSavingStudio(false);
    }
  }

  async function saveService(service: ServiceDraft) {
    const name = service.name.trim();
    const durationMinutes = parseDuration(service.duration);
    const priceInr = parseMoney(service.price);
    if (!name) {
      setError('Enter a service name.');
      return;
    }
    if (!durationMinutes || priceInr === null) {
      setError(`Check the price and duration for ${name}.`);
      return;
    }
    setSavingId(service.id);
    setError(null);
    try {
      const saved = await updateService({ id: service.id, name, durationMinutes, priceInr });
      const draft = toDraft(saved);
      baseline.current = baseline.current.map((item) => (item.id === service.id ? plain([draft])[0] : item));
      commitServices(servicesRef.current.map((item) => (item.id === service.id ? draft : item)));
      setNotice(`${saved.name} saved. New bookings use this price.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that service');
    } finally {
      setSavingId(null);
    }
  }

  async function addService() {
    const name = newName.trim();
    const durationMinutes = parseDuration(newDuration);
    const priceInr = parseMoney(newPrice);
    if (!name) {
      setError('Enter a service name.');
      return;
    }
    if (!durationMinutes || priceInr === null) {
      setError(`Check the price and duration for ${name}.`);
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const created = await createService({ name, durationMinutes, priceInr });
      const draft = toDraft(created);
      baseline.current = [...baseline.current, plain([draft])[0]];
      commitServices([...servicesRef.current, draft]);
      addDirty.current = false;
      setNewName('');
      setNewDuration('');
      setNewPrice('');
      setNotice(`${created.name} added to the menu.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that service');
    } finally {
      setAdding(false);
    }
  }

  async function removeService(service: ServiceDraft) {
    if (!service.confirmDelete) {
      commitServices(
        servicesRef.current.map((item) => (item.id === service.id ? { ...item, confirmDelete: true } : { ...item, confirmDelete: false })),
      );
      return;
    }
    setSavingId(service.id);
    setError(null);
    try {
      await deleteService(service.id);
      baseline.current = baseline.current.filter((item) => item.id !== service.id);
      commitServices(servicesRef.current.filter((item) => item.id !== service.id));
      setNotice(`${service.name} removed. Past visits keep the name and price they were booked with.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove that service');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <Screen>
      <PageHeader
        kicker="Studio"
        title="Settings"
        subtitle="Set any slot length, and add or change services. A visit keeps the price from the day it was booked."
      />
      {error ? <Notice>{error}</Notice> : null}
      {notice ? <Notice tone="gold">{notice}</Notice> : null}
      {loading && services.length === 0 ? <ActivityIndicator color={theme.gold} /> : null}
      <TextField
        label="Weekly target"
        value={target}
        onChangeText={(value) => markStudio(() => setTarget(value))}
        keyboardType="decimal-pad"
        prefix="₹"
      />
      <FieldRow>
        <TextField label="Opens" value={openTime} onChangeText={(value) => markStudio(() => setOpenTime(value))} placeholder="10:00" />
        <TextField label="Closes" value={closeTime} onChangeText={(value) => markStudio(() => setCloseTime(value))} placeholder="20:00" />
      </FieldRow>
      <TextField
        label="Slot interval"
        value={slotMinutes}
        onChangeText={(value) => markStudio(() => setSlotMinutes(value.replace(/[^\d]/g, '')))}
        keyboardType="number-pad"
        hint="Minutes between start times. Any length from 5 to 180."
      />
      <View style={styles.slots}>
        {QUICK_SLOTS.map((minutes) => {
          const selected = slotMinutes === String(minutes);
          return (
            <Pressable
              key={minutes}
              accessibilityRole="button"
              onPress={() => markStudio(() => setSlotMinutes(String(minutes)))}
              style={[styles.slot, selected && styles.slotOn]}>
              <AppText style={{ color: selected ? theme.ink : theme.text, fontFamily: theme.font.semibold }}>
                {minutes} min
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <GoldButton
        testID="save-settings"
        label={savingStudio ? 'Saving' : 'Save studio'}
        onPress={saveStudio}
        disabled={savingStudio}
      />

      <AppText style={styles.section}>Service menu</AppText>
      <View style={{ gap: 12 }}>
        {services.map((service) => (
          <GlassCard key={service.id}>
            <TextField
              label="Name"
              accessibilityLabel={`${service.name} name`}
              value={service.name}
              onChangeText={(value) => editService(service.id, { name: value })}
            />
            <FieldRow>
              <TextField
                label="Duration"
                accessibilityLabel={`${service.name} duration`}
                value={service.duration}
                onChangeText={(value) => editService(service.id, { duration: value })}
                keyboardType="number-pad"
              />
              <TextField
                label="Price"
                accessibilityLabel={`${service.name} price`}
                value={service.price}
                onChangeText={(value) => editService(service.id, { price: value })}
                keyboardType="decimal-pad"
                prefix="₹"
              />
            </FieldRow>
            <View style={styles.actions}>
              <GhostButton
                testID={`save-service-${service.name}`}
                label={savingId === service.id && !service.confirmDelete ? 'Saving' : 'Save'}
                onPress={() => saveService(service)}
              />
              <GhostButton
                testID={`delete-service-${service.name}`}
                label={service.confirmDelete ? `Delete ${service.name}` : 'Delete'}
                tone="rose"
                onPress={() => removeService(service)}
              />
            </View>
          </GlassCard>
        ))}
      </View>

      <AppText style={styles.section}>Add a service</AppText>
      <GlassCard>
        <TextField
          label="Name"
          accessibilityLabel="New service name"
          value={newName}
          onChangeText={(value) => {
            addDirty.current = Boolean(value.trim() || newDuration.trim() || newPrice.trim());
            setNotice(null);
            setNewName(value);
          }}
          placeholder="Brow tint"
        />
        <FieldRow>
          <TextField
            label="Duration"
            accessibilityLabel="New service duration"
            value={newDuration}
            onChangeText={(value) => {
              addDirty.current = Boolean(newName.trim() || value.trim() || newPrice.trim());
              setNewDuration(value);
            }}
            keyboardType="number-pad"
            placeholder="20"
          />
          <TextField
            label="Price"
            accessibilityLabel="New service price"
            value={newPrice}
            onChangeText={(value) => {
              addDirty.current = Boolean(newName.trim() || newDuration.trim() || value.trim());
              setNewPrice(value);
            }}
            keyboardType="decimal-pad"
            prefix="₹"
            placeholder="600"
          />
        </FieldRow>
        <GoldButton testID="add-service" label={adding ? 'Adding' : 'Add service'} onPress={addService} disabled={adding} />
      </GlassCard>

      <View style={{ height: 18 }} />
      <GhostButton label="Sign out" tone="rose" onPress={() => signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  slots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  slot: {
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  slotOn: {
    backgroundColor: theme.gold,
    borderColor: theme.gold,
  },
  section: {
    fontFamily: theme.font.semibold,
    fontSize: 18,
    marginTop: 22,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
});
