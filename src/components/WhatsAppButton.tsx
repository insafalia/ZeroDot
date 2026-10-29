import { useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AppText, GoldButton, GhostButton, Notice } from '@/components/ui';
import {
  buildWhatsAppMessage,
  openWhatsApp,
  whatsappHint,
  whatsappPhone,
  type WhatsAppAppointment,
} from '@/lib/whatsapp';
import { theme } from '@/theme';

export function WhatsAppButton({
  appointment,
  compact = false,
}: {
  appointment: WhatsAppAppointment;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const hasPhone = Boolean(whatsappPhone(appointment.client?.phone));

  function start() {
    setError(null);
    setMessage(buildWhatsAppMessage(appointment));
    setOpen(true);
  }

  async function send() {
    const phone = appointment.client?.phone;
    if (!phone) {
      setError('This visit has no mobile number.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await openWhatsApp(phone, message.trim() || buildWhatsAppMessage(appointment));
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open WhatsApp');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send WhatsApp message"
        disabled={!hasPhone}
        hitSlop={8}
        onPress={start}
        style={[styles.iconButton, compact && styles.iconCompact, !hasPhone && styles.iconDisabled]}>
        <View style={styles.iconMark}>
          <AppText style={styles.iconGlyph}>WA</AppText>
        </View>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <AppText style={styles.title}>WhatsApp</AppText>
            <AppText style={styles.hint}>{whatsappHint(appointment)}</AppText>
            {error ? <Notice>{error}</Notice> : null}
            <TextInput
              accessibilityLabel="WhatsApp message"
              value={message}
              onChangeText={setMessage}
              multiline
              placeholderTextColor={theme.faint}
              selectionColor={theme.gold}
              style={styles.input}
            />
            <GoldButton label={sending ? 'Opening' : 'Open WhatsApp'} onPress={send} disabled={sending || !message.trim()} />
            <View style={{ height: 8 }} />
            <GhostButton label="Cancel" onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCompact: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  iconDisabled: {
    opacity: 0.35,
  },
  iconMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: {
    color: '#053b1f',
    fontFamily: theme.font.bold,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8, 10, 14, 0.72)',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: '#161b26',
    padding: 18,
  },
  title: {
    fontFamily: theme.font.semibold,
    fontSize: 18,
  },
  hint: {
    color: theme.muted,
    marginTop: 4,
    marginBottom: 14,
    fontSize: 13,
  },
  input: {
    minHeight: 140,
    textAlignVertical: 'top',
    color: theme.text,
    fontFamily: theme.font.regular,
    fontSize: 15,
    lineHeight: 22,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
});
