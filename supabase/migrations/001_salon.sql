begin;

create table if not exists public.salon_settings (
  id integer primary key default 1 check (id = 1),
  weekly_target_inr numeric(12, 2) not null default 25000,
  open_time time not null default '10:00',
  close_time time not null default '20:00',
  slot_minutes integer not null default 30 check (slot_minutes >= 5 and slot_minutes <= 180),
  updated_at timestamptz not null default now(),
  constraint salon_hours_order check (close_time > open_time)
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  duration_minutes integer not null check (duration_minutes > 0),
  price_inr numeric(10, 2) not null check (price_inr >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_phone_format check (phone ~ '^[6-9][0-9]{9}$'),
  constraint clients_name_not_blank check (name is null or length(btrim(name)) > 0)
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  service_id uuid references public.services (id) on delete set null,
  service_name text not null,
  appointment_date date not null,
  start_time time not null,
  duration_minutes integer not null check (duration_minutes > 0),
  price_inr numeric(10, 2) not null check (price_inr >= 0),
  status text not null default 'confirmed' check (
    status in ('confirmed', 'in_progress', 'completed', 'no_show', 'cancelled')
  ),
  formula_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists appointments_date_idx on public.appointments (appointment_date);
create index if not exists appointments_client_idx on public.appointments (client_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists salon_settings_touch on public.salon_settings;
create trigger salon_settings_touch
before update on public.salon_settings
for each row execute function public.touch_updated_at();

drop trigger if exists services_touch on public.services;
create trigger services_touch
before update on public.services
for each row execute function public.touch_updated_at();

drop trigger if exists clients_touch on public.clients;
create trigger clients_touch
before update on public.clients
for each row execute function public.touch_updated_at();

drop trigger if exists appointments_touch on public.appointments;
create trigger appointments_touch
before update on public.appointments
for each row execute function public.touch_updated_at();

insert into public.salon_settings (id)
select 1
where not exists (select 1 from public.salon_settings where id = 1);

alter table public.salon_settings add column if not exists owner_email text;
update public.salon_settings
set owner_email = 'studio@zerodot.app'
where id = 1;
alter table public.salon_settings alter column owner_email set not null;

create or replace function public.current_owner_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select owner_email from public.salon_settings where id = 1
$$;

insert into public.services (name, duration_minutes, price_inr, sort_order)
values
  ('Haircut', 45, 800, 1),
  ('Balayage', 180, 8000, 2),
  ('Keratin', 150, 6000, 3),
  ('Facial', 60, 1500, 4),
  ('Mani-Pedi', 75, 1200, 5)
on conflict (name) do nothing;

alter table public.salon_settings enable row level security;
alter table public.services enable row level security;
alter table public.clients enable row level security;
alter table public.appointments enable row level security;

revoke all on table public.salon_settings from anon;
revoke all on table public.services from anon;
revoke all on table public.clients from anon;
revoke all on table public.appointments from anon;

grant select, insert, update, delete on table public.salon_settings to authenticated;
grant select, insert, update, delete on table public.services to authenticated;
grant select, insert, update, delete on table public.clients to authenticated;
grant select, insert, update, delete on table public.appointments to authenticated;

drop policy if exists owner_all on public.salon_settings;
create policy owner_all on public.salon_settings
for all to authenticated
using ((auth.jwt() ->> 'email') = public.current_owner_email())
with check ((auth.jwt() ->> 'email') = public.current_owner_email());

drop policy if exists owner_all on public.services;
create policy owner_all on public.services
for all to authenticated
using ((auth.jwt() ->> 'email') = public.current_owner_email())
with check ((auth.jwt() ->> 'email') = public.current_owner_email());

drop policy if exists owner_all on public.clients;
create policy owner_all on public.clients
for all to authenticated
using ((auth.jwt() ->> 'email') = public.current_owner_email())
with check ((auth.jwt() ->> 'email') = public.current_owner_email());

drop policy if exists owner_all on public.appointments;
create policy owner_all on public.appointments
for all to authenticated
using ((auth.jwt() ->> 'email') = public.current_owner_email())
with check ((auth.jwt() ->> 'email') = public.current_owner_email());

revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.current_owner_email() from public, anon;
grant execute on function public.current_owner_email() to authenticated;

commit;
