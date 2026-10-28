import type { AppointmentStatus } from '@/theme';

const IST = 'Asia/Kolkata';

export function formatInr(value: number): string {
  const amount = Number.isFinite(value) ? value : 0;
  const digits = Number.isInteger(amount) ? 0 : 2;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(amount);
  } catch {
    return `₹${amount.toFixed(digits)}`;
  }
}

export function formatAmountInput(value: number): string {
  if (!Number.isFinite(value)) return '';
  return Number.isInteger(value) ? String(value) : String(value);
}

export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  let national = digits;
  if (national.length === 12 && national.startsWith('91')) national = national.slice(2);
  if (national.length === 11 && national.startsWith('0')) national = national.slice(1);
  if (!/^[6-9]\d{9}$/.test(national)) return null;
  return national;
}

export function formatPhone(phone: string): string {
  if (phone.length !== 10) return phone;
  return `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`;
}

export function clientLabel(client?: { name?: string | null; phone?: string | null } | null): string {
  const name = client?.name?.trim();
  if (name) return name;
  if (client?.phone) return formatPhone(client.phone);
  return 'Client';
}

export function phoneSearchDigits(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length >= 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

export function istTodayIso(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function greeting(now = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: IST,
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(now),
  );
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const weekdayIndex: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

export function addDaysIso(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getUTCDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

export function weekdayOffset(iso: string): number {
  const date = new Date(`${iso}T12:00:00+05:30`);
  const label = new Intl.DateTimeFormat('en-US', { timeZone: IST, weekday: 'short' }).format(date);
  return weekdayIndex[label] ?? 0;
}

export function weekBounds(iso: string): { start: string; end: string } {
  const start = addDaysIso(iso, -weekdayOffset(iso));
  return { start, end: addDaysIso(start, 6) };
}

export function monthBounds(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(days).padStart(2, '0')}`;
  return { start, end };
}

export function monthWeeks(year: number, month: number): (string | null)[][] {
  const { start, end } = monthBounds(year, month);
  const cells: (string | null)[] = Array.from({ length: weekdayOffset(start) }, () => null);
  let cursor = start;
  while (cursor <= end) {
    cells.push(cursor);
    cursor = addDaysIso(cursor, 1);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
  return weeks;
}

export function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatLongDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

export function formatShortDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export function minutesFromTime(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function timeFromMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
}

export function normalizeTime(value: string): string {
  const [hours = '00', minutes = '00', seconds = '00'] = value.split(':');
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
}

export function isTimeValue(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value.trim());
}

export function formatTimeLabel(value: string): string {
  const [hours, minutes] = value.split(':').map(Number);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour = hours % 12 || 12;
  return `${hour}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

export function buildSlots(openTime: string, closeTime: string, slotMinutes: number): string[] {
  const start = minutesFromTime(openTime);
  const end = minutesFromTime(closeTime);
  const slots: string[] = [];
  for (let cursor = start; cursor + slotMinutes <= end; cursor += slotMinutes) {
    slots.push(timeFromMinutes(cursor));
  }
  return slots;
}

export function rangesOverlap(startA: string, durationA: number, startB: string, durationB: number): boolean {
  const a0 = minutesFromTime(startA);
  const b0 = minutesFromTime(startB);
  return a0 < b0 + durationB && b0 < a0 + durationA;
}

export function isBlockingStatus(status: AppointmentStatus): boolean {
  return status === 'confirmed' || status === 'in_progress' || status === 'completed';
}

export function parseMoney(value: string): number | null {
  const cleaned = value.replace(/[₹,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const amount = Number(cleaned);
  if (amount < 0 || amount > 99999999) return null;
  return amount;
}

export function parseSlotMinutes(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const minutes = Number(value.trim());
  if (minutes < 5 || minutes > 180) return null;
  return minutes;
}

export function parseDuration(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const minutes = Number(value.trim());
  if (minutes <= 0 || minutes > 24 * 60) return null;
  return minutes;
}
