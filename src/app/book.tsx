import { Redirect, router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useAuth } from '@/auth';
import { StatusChips } from '@/components/StatusChips';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { AppText, FieldRow, GhostButton, GoldButton, Notice, PageHeader, Screen, TextField } from '@/components/ui';
import { fetchAppointment, fetchAppointmentsBetween, fetchServices, fetchSettings, saveBooking, searchClients } from '@/lib/api';
import { useSalonLive } from '@/lib/live';
import {
  addDaysIso,
  buildSlots,
  clientLabel,
  formatAmountInput,
  formatInr,
  formatLongDate,
  formatPhone,
  formatTimeLabel,
  isBlockingStatus,
  isPastSlot,
  istTodayIso,
  minutesFromTime,
  normalizePhone,
  normalizeTime,
  parseDuration,
  parseMoney,
  pastSlotStatuses,
  rangesOverlap,
} from '@/lib/format';
import { theme, type AppointmentStatus } from '@/theme';
import type { Appointment, Client, SalonSettings, Service } from '@/types';

function one(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default function BookScreen() {
  const { session } = useAuth();
  const params = useLocalSearchParams<{ id?: string; date?: string; time?: string }>();
  const appointmentId = one(params.id);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [duration, setDuration] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(one(params.date) || istTodayIso());
  const [time, setTime] = useState(one(params.time) ? normalizeTime(one(params.time) as string) : '');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<AppointmentStatus>('confirmed');
  const [services, setServices] = useState<Service[]>([]);
  const [settings, setSettings] = useState<SalonSettings | null>(null);
  const [matches, setMatches] = useState<Client[]>([]);
  const [dayRows, setDayRows] = useState<Appointment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [serviceRows, salon] = await Promise.all([fetchServices(), fetchSettings()]);
        if (!active) return;
        setServices(serviceRows);
        setSettings(salon);
        if (appointmentId) {
          const existing = await fetchAppointment(appointmentId);
          if (!active) return;
          if (!existing) throw new Error('That booking could not be found.');
          setPhone(existing.client?.phone ?? '');
          setName(existing.client?.name ?? '');
          setServiceId(existing.service_id);
          setDuration(String(existing.duration_minutes));
          setPrice(formatAmountInput(existing.price_inr));
          setDate(existing.appointment_date);
          setTime(normalizeTime(existing.start_time));
          setNotes(existing.formula_notes ?? '');
          setStatus(existing.status);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Could not open the booking');
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [appointmentId]);

  useSalonLive(() => {
    Promise.all([fetchServices(), fetchSettings()])
      .then(([serviceRows, salon]) => {
        setServices(serviceRows);
        setSettings(salon);
      })
      .catch(() => undefined);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      fetchAppointmentsBetween(date, date)
        .then(setDayRows)
        .catch(() => undefined);
    }
  });

  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    let active = true;
    fetchAppointmentsBetween(date, date)
      .then((rows) => {
        if (active) setDayRows(rows);
      })
      .catch(() => {
        if (active) setDayRows([]);
      });
    return () => {
      active = false;
    };
  }, [date]);

  useEffect(() => {
    const digits = phone.replace(/\D/g, '');
    const nameQuery = name.trim();
    const query = digits.length >= 3 ? phone : nameQuery.length >= 2 ? nameQuery : '';
    if (!query) {
      setMatches([]);
      return;
    }
    const handle = setTimeout(() => {
      searchClients(query)
        .then(setMatches)
        .catch(() => setMatches([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [phone, name]);

  const slots = useMemo(() => {
    if (!settings) return time ? [normalizeTime(time)] : [];
    const base = buildSlots(settings.open_time, settings.close_time, settings.slot_minutes);
    const current = time ? normalizeTime(time) : '';
    if (current && !base.includes(current)) return [current, ...base];
    return base;
  }, [settings, time]);

  const parsedDuration = parseDuration(duration);
  const overlaps =
    time && parsedDuration
      ? dayRows.filter(
          (row) =>
            row.id !== appointmentId &&
            isBlockingStatus(row.status) &&
            rangesOverlap(time, parsedDuration, row.start_time, row.duration_minutes),
        )
      : [];
  const pastClose =
    settings && time && parsedDuration
      ? minutesFromTime(time) + parsedDuration > minutesFromTime(settings.close_time)
      : false;
  const bookingInPast = Boolean(time && isPastSlot(date, time));
  const statusOptions = bookingInPast ? pastSlotStatuses : undefined;

  useEffect(() => {
    if (!bookingInPast) return;
    if (!pastSlotStatuses.includes(status)) setStatus('completed');
  }, [bookingInPast, status]);

  const normalized = normalizePhone(phone);
  const exact = matches.find((match) => match.phone === normalized);
  const suggestions = matches
    .filter((match) => match.phone !== normalized || (match.name ?? '') !== name.trim())
    .slice(0, 5);

  function chooseService(service: Service) {
    if (service.id === serviceId) return;
    setServiceId(service.id);
    setDuration(String(service.duration_minutes));
    setPrice(formatAmountInput(service.price_inr));
  }

  function chooseClient(client: Client) {
    setPhone(client.phone);
    setName(client.name ?? '');
    setMatches([]);
  }

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/' as Href);
  }

  async function save() {
    const service = services.find((item) => item.id === serviceId);
    const nextPhone = normalizePhone(phone);
    const nextPrice = parseMoney(price);
    const nextDuration = parseDuration(duration);
    if (!nextPhone) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (!service) {
      setError('Choose a service.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Choose a date.');
      return;
    }
    if (!time) {
      setError('Choose a time.');
      return;
    }
    if (!nextDuration) {
      setError('Enter a duration in minutes.');
      return;
    }
    if (nextPrice === null) {
      setError('Enter a price in rupees.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveBooking({
        id: appointmentId,
        phone: nextPhone,
        name,
        serviceId: service.id,
        serviceName: service.name,
        date,
        startTime: normalizeTime(time),
        durationMinutes: nextDuration,
        priceInr: nextPrice,
        formulaNotes: notes,
        status,
      });
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the booking');
      setSaving(false);
    }
  }

  if (!session) return <Redirect href="/login" />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Screen>
        <View style={styles.top}>
          <View style={{ flex: 1 }}>
            <PageHeader
              kicker="Booking"
              title={appointmentId ? 'Edit visit' : 'New visit'}
              subtitle="Price starts from the menu and stays editable for this visit."
            />
          </View>
          <View style={styles.topActions}>
            {appointmentId && normalized ? (
              <WhatsAppButton
                appointment={{
                  appointment_date: date,
                  start_time: time || '00:00:00',
                  service_name: services.find((item) => item.id === serviceId)?.name ?? 'visit',
                  status,
                  client: { name: name || null, phone: normalized },
                }}
              />
            ) : null}
            <GhostButton label="Close" onPress={close} />
          </View>
        </View>
        {!ready ? <ActivityIndicator color={theme.gold} /> : null}
        {error ? <Notice>{error}</Notice> : null}
        {ready ? (
          <>
            <TextField
              testID="phone"
              label="Mobile"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="98765 43210"
              hint="Required, and unique. The same number always belongs to the same client."
            />
            {exact ? (
              <AppText style={styles.known}>
                In your book{exact.name ? ` as ${exact.name}` : ''}. Leave the name blank to keep what is saved.
              </AppText>
            ) : null}
            {suggestions.length > 0 ? (
              <View style={styles.matches}>
                {suggestions.map((match) => (
                  <Pressable key={match.id} onPress={() => chooseClient(match)} style={styles.match}>
                    <AppText style={{ fontFamily: theme.font.semibold }}>{clientLabel(match)}</AppText>
                    {match.name ? <AppText style={styles.matchPhone}>{formatPhone(match.phone)}</AppText> : null}
                  </Pressable>
                ))}
              </View>
            ) : null}
            <TextField
              testID="client-name"
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="Optional"
              hint="Optional. If it is empty, the number is what you will see."
            />
            <AppText style={styles.label}>Service</AppText>
            <View style={styles.services}>
              {services.map((service) => {
                const selected = service.id === serviceId;
                return (
                  <Pressable
                    key={service.id}
                    accessibilityRole="button"
                    testID={`service-${service.name}`}
                    onPress={() => chooseService(service)}
                    style={[styles.service, selected && styles.serviceOn]}>
                    <AppText style={[styles.serviceName, selected && { color: theme.ink }]}>{service.name}</AppText>
                    <AppText style={[styles.serviceMeta, selected && { color: theme.ink }]}>
                      {service.duration_minutes} min · {formatInr(service.price_inr)}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
            <FieldRow>
              <TextField
                label="Duration"
                value={duration}
                onChangeText={setDuration}
                keyboardType="number-pad"
                placeholder="45"
                hint="Minutes"
              />
              <TextField
                testID="price"
                label="Price"
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
                prefix="₹"
                placeholder="800"
                hint="This visit only"
              />
            </FieldRow>
            <AppText style={styles.label}>Date</AppText>
            <View style={styles.dateRow}>
              <GhostButton label="Prev" onPress={() => setDate(addDaysIso(date, -1))} />
              <AppText style={styles.dateLabel} numberOfLines={1}>
                {formatLongDate(date)}
              </AppText>
              <GhostButton label="Next" onPress={() => setDate(addDaysIso(date, 1))} />
            </View>
            <AppText style={styles.label}>Time</AppText>
            {settings && slots.length === 0 ? (
              <AppText style={styles.matchPhone}>No start times fit these hours. Use a shorter slot interval in Studio.</AppText>
            ) : null}
            <View style={styles.slots}>
              {slots.map((slot) => {
                const selected = time && normalizeTime(time) === slot;
                return (
                  <Pressable
                    key={slot}
                    accessibilityRole="button"
                    testID={`slot-${slot.slice(0, 5)}`}
                    onPress={() => setTime(slot)}
                    style={[styles.slot, selected && styles.slotOn]}>
                    <AppText style={{ color: selected ? theme.ink : theme.text, fontFamily: theme.font.medium }}>
                      {formatTimeLabel(slot)}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
            {overlaps.length > 0 ? (
              <View style={{ marginTop: 12 }}>
                <Notice>
                  {`Overlaps ${formatTimeLabel(overlaps[0].start_time)} · ${clientLabel(overlaps[0].client)} · ${overlaps[0].service_name}`}
                </Notice>
              </View>
            ) : null}
            {pastClose ? <Notice tone="gold">This visit runs past closing time.</Notice> : null}
            {bookingInPast ? (
              <Notice tone="gold">Past time — choose Completed, No-Show, or Cancelled.</Notice>
            ) : null}
            <TextField
              label="Formula / color notes"
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="Formula, developer, or anything you need at the chair"
            />
            <AppText style={styles.label}>Status</AppText>
            <StatusChips value={status} onChange={setStatus} allowed={statusOptions} />
            <View style={{ height: 18 }} />
            <GoldButton testID="save-booking" label={saving ? 'Saving' : 'Save booking'} onPress={save} disabled={saving || !ready} />
          </>
        ) : null}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  known: {
    color: theme.gold,
    marginTop: -6,
    marginBottom: 12,
  },
  matches: {
    marginBottom: 12,
    gap: 8,
  },
  match: {
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  matchPhone: {
    color: theme.muted,
    marginTop: 2,
  },
  label: {
    color: theme.gold,
    fontFamily: theme.font.medium,
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  services: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  service: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  serviceOn: {
    backgroundColor: theme.gold,
    borderColor: theme.gold,
  },
  serviceName: {
    fontFamily: theme.font.semibold,
  },
  serviceMeta: {
    color: theme.muted,
    fontSize: 12,
    marginTop: 2,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  dateLabel: {
    fontFamily: theme.font.semibold,
    textAlign: 'center',
    flex: 1,
  },
  slots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  slot: {
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  slotOn: {
    backgroundColor: theme.gold,
    borderColor: theme.gold,
  },
});
