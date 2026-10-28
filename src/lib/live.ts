import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

const tables = ['appointments', 'clients', 'services', 'salon_settings'] as const;

export function useSalonLive(onChange: () => void) {
  const saved = useRef(onChange);
  saved.current = onChange;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => saved.current(), 200);
    };
    const channel = supabase.channel(`salon-live-${Math.random().toString(36).slice(2)}`);
    for (const table of tables) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, schedule);
    }
    channel.subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, []);
}
