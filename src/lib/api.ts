import type { AppointmentStatus } from '@/theme';
import type { Appointment, Client, ClientSummary, DashboardData, SalonSettings, Service } from '@/types';
import { istTodayIso, monthBounds, phoneSearchDigits, weekBounds } from '@/lib/format';
import { supabase } from '@/lib/supabase';

type ClientRow = { id: string; phone: string; name: string | null };

type AppointmentRow = {
  id: string;
  client_id: string;
  service_id: string | null;
  service_name: string;
  appointment_date: string;
  start_time: string;
  duration_minutes: number;
  price_inr: number | string;
  status: AppointmentStatus;
  formula_notes: string | null;
  clients: ClientRow | ClientRow[] | null;
};

function asClient(value: ClientRow | ClientRow[] | null | undefined): Client | null {
  if (!value) return null;
  const row = Array.isArray(value) ? value[0] : value;
  if (!row) return null;
  return { id: row.id, phone: row.phone, name: row.name };
}

function asAppointment(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    client_id: row.client_id,
    service_id: row.service_id,
    service_name: row.service_name,
    appointment_date: row.appointment_date,
    start_time: row.start_time,
    duration_minutes: Number(row.duration_minutes),
    price_inr: Number(row.price_inr),
    status: row.status,
    formula_notes: row.formula_notes,
    client: asClient(row.clients),
  };
}

function asService(row: {
  id: string;
  name: string;
  duration_minutes: number;
  price_inr: number | string;
  active: boolean;
  sort_order: number;
}): Service {
  return {
    id: row.id,
    name: row.name,
    duration_minutes: Number(row.duration_minutes),
    price_inr: Number(row.price_inr),
    active: row.active,
    sort_order: row.sort_order,
  };
}

async function expect<T>(result: { data: T; error: { message: string } | null }): Promise<T> {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function fetchSettings(): Promise<SalonSettings> {
  const data = await expect(
    await supabase.from('salon_settings').select('*').eq('id', 1).single(),
  );
  const slot = Number(data.slot_minutes);
  return {
    id: data.id,
    weekly_target_inr: Number(data.weekly_target_inr),
    open_time: data.open_time,
    close_time: data.close_time,
    slot_minutes: Number.isFinite(slot) && slot >= 5 ? slot : 30,
  };
}

export async function fetchServices(): Promise<Service[]> {
  const data = await expect(
    await supabase.from('services').select('*').eq('active', true).order('sort_order'),
  );
  return (data ?? []).map(asService);
}

export async function fetchDashboard(): Promise<DashboardData> {
  const today = istTodayIso();
  const { start, end } = weekBounds(today);
  const [agendaResult, weekResult, clientResult, completedResult, settings] = await Promise.all([
    supabase
      .from('appointments')
      .select('*, clients(id, phone, name)')
      .eq('appointment_date', today)
      .order('start_time'),
    supabase
      .from('appointments')
      .select('price_inr')
      .eq('status', 'completed')
      .gte('appointment_date', start)
      .lte('appointment_date', end),
    supabase.from('clients').select('id', { count: 'exact', head: true }),
    supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
    fetchSettings(),
  ]);
  if (agendaResult.error) throw new Error(agendaResult.error.message);
  if (weekResult.error) throw new Error(weekResult.error.message);
  if (clientResult.error) throw new Error(clientResult.error.message);
  if (completedResult.error) throw new Error(completedResult.error.message);

  const agenda = ((agendaResult.data ?? []) as AppointmentRow[]).map(asAppointment);
  const todayEarnings = agenda
    .filter((item) => item.status === 'completed')
    .reduce((sum, item) => sum + item.price_inr, 0);
  const weekEarnings = (weekResult.data ?? []).reduce((sum, row) => sum + Number(row.price_inr), 0);

  return {
    today,
    weekStart: start,
    weekEnd: end,
    todayEarnings,
    weekEarnings,
    weeklyTarget: settings.weekly_target_inr,
    totalClients: clientResult.count ?? 0,
    completedCount: completedResult.count ?? 0,
    agenda,
  };
}

export type VisitSummary = {
  earnings: number;
  clients: number;
  visits: number;
  completed: number;
  confirmed: number;
  inProgress: number;
  noShow: number;
  cancelled: number;
};

export function summarizeVisits(rows: Appointment[]): VisitSummary {
  const completed = rows.filter((row) => row.status === 'completed');
  return {
    earnings: completed.reduce((sum, row) => sum + row.price_inr, 0),
    clients: new Set(rows.map((row) => row.client_id)).size,
    visits: rows.length,
    completed: completed.length,
    confirmed: rows.filter((row) => row.status === 'confirmed').length,
    inProgress: rows.filter((row) => row.status === 'in_progress').length,
    noShow: rows.filter((row) => row.status === 'no_show').length,
    cancelled: rows.filter((row) => row.status === 'cancelled').length,
  };
}

export async function fetchMonthVisits(year: number, month: number): Promise<Appointment[]> {
  const { start, end } = monthBounds(year, month);
  return fetchAppointmentsBetween(start, end);
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus): Promise<void> {
  const data = await expect(
    await supabase.from('appointments').update({ status }).eq('id', id).select('id'),
  );
  if (!data?.length) throw new Error('That visit could not be updated.');
}

export async function fetchAppointmentsBetween(start: string, end: string): Promise<Appointment[]> {
  const data = await expect(
    await supabase
      .from('appointments')
      .select('*, clients(id, phone, name)')
      .gte('appointment_date', start)
      .lte('appointment_date', end)
      .order('appointment_date')
      .order('start_time'),
  );
  return ((data ?? []) as AppointmentRow[]).map(asAppointment);
}

export async function fetchAppointment(id: string): Promise<Appointment | null> {
  const result = await supabase
    .from('appointments')
    .select('*, clients(id, phone, name)')
    .eq('id', id)
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) return null;
  return asAppointment(result.data as AppointmentRow);
}

export async function searchClients(query: string): Promise<Client[]> {
  const trimmed = query.trim();
  let request = supabase.from('clients').select('id, phone, name').order('updated_at', { ascending: false }).limit(40);
  if (trimmed) {
    const name = trimmed.replace(/[%_,.()"'\\]/g, '').trim();
    const digits = phoneSearchDigits(trimmed);
    const parts: string[] = [];
    if (name) parts.push(`name.ilike.%${name}%`);
    if (digits) parts.push(`phone.ilike.%${digits}%`);
    if (parts.length === 0) return [];
    request = supabase
      .from('clients')
      .select('id, phone, name')
      .or(parts.join(','))
      .order('updated_at', { ascending: false })
      .limit(40);
  }
  const data = await expect(await request);
  return (data ?? []) as Client[];
}

export async function fetchClientDirectory(query: string): Promise<ClientSummary[]> {
  const clients = await searchClients(query);
  if (clients.length === 0) return [];
  const data = await expect(
    await supabase.from('appointments').select('client_id, price_inr, status').in(
      'client_id',
      clients.map((client) => client.id),
    ),
  );
  const stats = new Map<string, { spent: number; visits: number }>();
  for (const row of data ?? []) {
    const current = stats.get(row.client_id) ?? { spent: 0, visits: 0 };
    if (row.status !== 'cancelled') current.visits += 1;
    if (row.status === 'completed') current.spent += Number(row.price_inr);
    stats.set(row.client_id, current);
  }
  return clients.map((client) => ({
    ...client,
    spent: stats.get(client.id)?.spent ?? 0,
    visits: stats.get(client.id)?.visits ?? 0,
  }));
}

export async function fetchClientDetail(id: string): Promise<{ client: Client; history: Appointment[] } | null> {
  const clientResult = await supabase.from('clients').select('id, phone, name').eq('id', id).maybeSingle();
  if (clientResult.error) throw new Error(clientResult.error.message);
  if (!clientResult.data) return null;
  const history = await expect(
    await supabase
      .from('appointments')
      .select('*, clients(id, phone, name)')
      .eq('client_id', id)
      .order('appointment_date', { ascending: false })
      .order('start_time', { ascending: false }),
  );
  return {
    client: clientResult.data as Client,
    history: ((history ?? []) as AppointmentRow[]).map(asAppointment),
  };
}

export async function upsertClient(phone: string, name: string): Promise<Client> {
  const trimmed = name.trim();
  const existingResult = await supabase.from('clients').select('id, phone, name').eq('phone', phone).maybeSingle();
  if (existingResult.error) throw new Error(existingResult.error.message);
  if (existingResult.data) {
    if (trimmed && trimmed !== existingResult.data.name) {
      const data = await expect(
        await supabase
          .from('clients')
          .update({ name: trimmed })
          .eq('id', existingResult.data.id)
          .select('id, phone, name')
          .single(),
      );
      if (!data) throw new Error('That client could not be updated.');
      return data as Client;
    }
    return existingResult.data as Client;
  }
  const data = await expect(
    await supabase
      .from('clients')
      .insert({ phone, name: trimmed || null })
      .select('id, phone, name')
      .single(),
  );
  return data as Client;
}

export async function saveBooking(input: {
  id?: string;
  phone: string;
  name: string;
  serviceId: string;
  serviceName: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  priceInr: number;
  formulaNotes: string;
  status: AppointmentStatus;
}): Promise<void> {
  const client = await upsertClient(input.phone, input.name);
  const row = {
    client_id: client.id,
    service_id: input.serviceId,
    service_name: input.serviceName,
    appointment_date: input.date,
    start_time: input.startTime,
    duration_minutes: input.durationMinutes,
    price_inr: input.priceInr,
    formula_notes: input.formulaNotes.trim() || null,
    status: input.status,
  };
  if (input.id) {
    const data = await expect(await supabase.from('appointments').update(row).eq('id', input.id).select('id'));
    if (!data?.length) throw new Error('That visit could not be saved.');
    return;
  }
  await expect(await supabase.from('appointments').insert(row));
}

function serviceError(error: { message: string }): Error {
  const message = error.message.toLowerCase();
  if (message.includes('duplicate') || message.includes('services_name')) {
    return new Error('A service with that name is already on the menu.');
  }
  return new Error(error.message);
}

export async function saveSalonSetup(input: {
  weeklyTarget: number;
  openTime: string;
  closeTime: string;
  slotMinutes: number;
}): Promise<void> {
  const settingsRow = await expect(
    await supabase
      .from('salon_settings')
      .update({
        weekly_target_inr: input.weeklyTarget,
        open_time: input.openTime,
        close_time: input.closeTime,
        slot_minutes: input.slotMinutes,
      })
      .eq('id', 1)
      .select('id'),
  );
  if (!settingsRow?.length) throw new Error('Studio settings could not be saved.');
}

export async function createService(input: {
  name: string;
  durationMinutes: number;
  priceInr: number;
}): Promise<Service> {
  const existing = await expect(await supabase.from('services').select('sort_order').order('sort_order', { ascending: false }).limit(1));
  const sortOrder = Number(existing?.[0]?.sort_order ?? 0) + 1;
  const result = await supabase
    .from('services')
    .insert({
      name: input.name,
      duration_minutes: input.durationMinutes,
      price_inr: input.priceInr,
      sort_order: sortOrder,
      active: true,
    })
    .select('*')
    .single();
  if (result.error || !result.data) throw result.error ? serviceError(result.error) : new Error('The service could not be saved.');
  return asService(result.data);
}

export async function updateService(input: {
  id: string;
  name: string;
  durationMinutes: number;
  priceInr: number;
}): Promise<Service> {
  const result = await supabase
    .from('services')
    .update({
      name: input.name,
      duration_minutes: input.durationMinutes,
      price_inr: input.priceInr,
    })
    .eq('id', input.id)
    .select('*')
    .single();
  if (result.error || !result.data) throw result.error ? serviceError(result.error) : new Error('The service could not be saved.');
  return asService(result.data);
}

export async function deleteService(id: string): Promise<void> {
  const data = await expect(await supabase.from('services').delete().eq('id', id).select('id'));
  if (!data?.length) throw new Error('That service could not be removed.');
}
