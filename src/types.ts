import type { AppointmentStatus } from '@/theme';

export type Client = {
  id: string;
  phone: string;
  name: string | null;
};

export type ClientSummary = Client & {
  spent: number;
  visits: number;
};

export type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price_inr: number;
  active: boolean;
  sort_order: number;
};

export type SalonSettings = {
  id: number;
  weekly_target_inr: number;
  open_time: string;
  close_time: string;
  slot_minutes: number;
};

export type Appointment = {
  id: string;
  client_id: string;
  service_id: string | null;
  service_name: string;
  appointment_date: string;
  start_time: string;
  duration_minutes: number;
  price_inr: number;
  status: AppointmentStatus;
  formula_notes: string | null;
  client: Client | null;
};

export type DashboardData = {
  today: string;
  weekStart: string;
  weekEnd: string;
  todayEarnings: number;
  weekEarnings: number;
  weeklyTarget: number;
  totalClients: number;
  completedCount: number;
  agenda: Appointment[];
};
