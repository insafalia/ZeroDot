alter table public.salon_settings drop constraint if exists salon_settings_slot_minutes_check;

alter table public.salon_settings
  add constraint salon_settings_slot_minutes_check
  check (slot_minutes >= 5 and slot_minutes <= 180);

do $$
declare
  table_name text;
begin
  foreach table_name in array array['salon_settings', 'services', 'clients', 'appointments']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    exception
      when duplicate_object then
        null;
    end;
  end loop;
end $$;
