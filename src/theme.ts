export const theme = {
  bg: '#0f1219',
  gold: '#e5c158',
  goldSoft: 'rgba(229, 193, 88, 0.16)',
  rose: '#f43f5e',
  roseSoft: 'rgba(244, 63, 94, 0.16)',
  text: '#f7f3ea',
  muted: '#b7ad9c',
  faint: '#8d8476',
  line: 'rgba(229, 193, 88, 0.28)',
  ink: '#1a1406',
  font: {
    regular: 'PlusJakartaSans_400Regular',
    medium: 'PlusJakartaSans_500Medium',
    semibold: 'PlusJakartaSans_600SemiBold',
    bold: 'PlusJakartaSans_700Bold',
  },
} as const;

export const statusMeta = {
  confirmed: { label: 'Confirmed', color: '#e5c158' },
  in_progress: { label: 'In Progress', color: '#f43f5e' },
  completed: { label: 'Completed', color: '#b7d4c2' },
  no_show: { label: 'No-Show', color: '#c4b8a5' },
  cancelled: { label: 'Cancelled', color: '#8a8175' },
} as const;

export type AppointmentStatus = keyof typeof statusMeta;

export const statusOrder = Object.keys(statusMeta) as AppointmentStatus[];
