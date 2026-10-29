import { Linking } from 'react-native';
import { clientLabel, formatLongDate, formatPhone, formatTimeLabel, isPastSlot, normalizePhone } from '@/lib/format';
import type { AppointmentStatus } from '@/theme';

export const SALON_NAME = 'ZeroDot Salon';

export type WhatsAppAppointment = {
  appointment_date: string;
  start_time: string;
  service_name: string;
  status: AppointmentStatus;
  client?: { name?: string | null; phone?: string | null } | null;
};

export type WhatsAppMessageKind = 'reminder' | 'running_late' | 'completed' | 'no_show' | 'cancelled' | 'in_progress';

export function whatsappMessageKind(item: WhatsAppAppointment): WhatsAppMessageKind {
  if (item.status === 'completed') return 'completed';
  if (item.status === 'no_show') return 'no_show';
  if (item.status === 'cancelled') return 'cancelled';
  if (item.status === 'in_progress') return 'in_progress';
  if (isPastSlot(item.appointment_date, item.start_time)) return 'running_late';
  return 'reminder';
}

export function buildWhatsAppMessage(item: WhatsAppAppointment, kind = whatsappMessageKind(item)): string {
  const name = clientLabel(item.client);
  const when = `${formatLongDate(item.appointment_date)} at ${formatTimeLabel(item.start_time)}`;
  const service = item.service_name;

  switch (kind) {
    case 'reminder':
      return `Hi ${name}, this is a reminder from ${SALON_NAME}. Your ${service} is booked for ${when}. See you soon!`;
    case 'running_late':
      return `Hi ${name}, this is ${SALON_NAME}. Your ${service} slot for ${when} has started and we are waiting for you. Please reply if you are on the way or need to reschedule.`;
    case 'in_progress':
      return `Hi ${name}, thank you for visiting ${SALON_NAME}. Your ${service} is in progress. Let us know if you need anything.`;
    case 'completed':
      return `Hi ${name}, thank you for visiting ${SALON_NAME} for your ${service} on ${when}. We hope you loved it — message us anytime to book again.`;
    case 'no_show':
      return `Hi ${name}, we missed you at ${SALON_NAME} for your ${service} on ${when}. Reply here if you would like to rebook.`;
    case 'cancelled':
      return `Hi ${name}, your ${service} at ${SALON_NAME} on ${when} is cancelled. Reply anytime if you would like a new time.`;
  }
}

export function whatsappPhone(phone: string | null | undefined): string | null {
  const national = phone ? normalizePhone(phone) : null;
  return national ? `91${national}` : null;
}

export function whatsappUrl(phone: string, message: string): string | null {
  const e164 = whatsappPhone(phone);
  if (!e164) return null;
  return `https://wa.me/${e164}?text=${encodeURIComponent(message)}`;
}

export async function openWhatsApp(phone: string, message: string): Promise<void> {
  const url = whatsappUrl(phone, message);
  if (!url) throw new Error('Add a valid Indian mobile number before WhatsApp.');
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) throw new Error('WhatsApp could not be opened on this device.');
  await Linking.openURL(url);
}

export function whatsappHint(item: WhatsAppAppointment): string {
  const phone = item.client?.phone ? formatPhone(item.client.phone) : 'client';
  switch (whatsappMessageKind(item)) {
    case 'reminder':
      return `Reminder for ${phone}`;
    case 'running_late':
      return `Running late — ${phone}`;
    case 'in_progress':
      return `In progress — ${phone}`;
    case 'completed':
      return `Thank-you note — ${phone}`;
    case 'no_show':
      return `Missed visit — ${phone}`;
    case 'cancelled':
      return `Cancellation note — ${phone}`;
  }
}
