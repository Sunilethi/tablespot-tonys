-- =========================================================================
-- TABLESPOT — DATABASE SCHEMA
-- Run this once in Supabase: Project → SQL Editor → New query → paste → Run
-- =========================================================================

-- One row per restaurant client (Tony's today; more clients later = more rows)
create table if not exists restaurants (
  id text primary key,
  name text not null,
  product_brand text not null default 'Tablespot',
  admin_pin text not null default '9999',
  open_time text not null default '11:30',
  close_time text not null default '22:00',
  booking_duration_minutes int not null default 90,
  slot_interval_minutes int not null default 30,
  reply_to_email text,
  privacy_policy_url text,
  created_at timestamptz not null default now()
);

create table if not exists branches (
  id text primary key,
  restaurant_id text not null references restaurants(id) on delete cascade,
  name text not null,
  city text,
  address text,
  phone text,
  closed_day int,                              -- null = open every day, 0=Sun .. 6=Sat
  capacity int not null default 50,
  pin text not null,
  blocked_dates jsonb not null default '[]'::jsonb,
  capacity_overrides jsonb not null default '[]'::jsonb
);

create table if not exists bookings (
  id text primary key,
  restaurant_id text not null references restaurants(id) on delete cascade,
  branch_id text not null references branches(id) on delete cascade,
  ref text not null,
  date text not null,                           -- 'YYYY-MM-DD'
  time text not null,                           -- 'HH:MM'
  guests int not null,
  name text not null,
  email text,
  phone text,
  notes text,
  allergy text,
  child_seat boolean not null default false,
  status text not null default 'pending',       -- pending/confirmed/arrived/seated/completed/cancelled/no_show/waitlisted
  source text not null default 'website',       -- website/phone/walk_in
  lang text not null default 'en',               -- 'en' or 'de' — which language to email the guest in
  staff_notes text default '',
  privacy_consent_at timestamptz,               -- when the guest accepted the privacy policy (website bookings)
  allergy_consent boolean not null default false, -- separate explicit consent for Art. 9 GDPR health data
  policy_version text,                           -- which version of the privacy policy was shown
  created_at timestamptz not null default now()
);

create index if not exists idx_bookings_lookup on bookings (restaurant_id, branch_id, date);
create index if not exists idx_bookings_status  on bookings (restaurant_id, date, status);

-- Lock the tables down from the public/anon key. Only the service_role key
-- (used privately by the Apps Script backend, never sent to a browser) can
-- read or write — this is what keeps the data actually secure.
alter table restaurants enable row level security;
alter table branches    enable row level security;
alter table bookings    enable row level security;
-- (No policies are created, which means: no access at all via the public
-- anon key. The service_role key bypasses RLS entirely, which is exactly
-- what the backend script uses.)

-- ---------------------------------------------------------------------
-- Seed data: Tony's Ristorante, with the real branch details from the
-- live site (tonysristorante.de) as of today.
-- ---------------------------------------------------------------------

insert into restaurants (id, name, product_brand, admin_pin, open_time, close_time, booking_duration_minutes, slot_interval_minutes, reply_to_email, privacy_policy_url)
values ('tonys', 'Tony''s Ristorante', 'Tablespot', '9999', '11:30', '22:00', 90, 30, 'bookings@tonysristorante.de', 'https://tonysristorante.de/datenschutz')
on conflict (id) do nothing;

insert into branches (id, restaurant_id, name, city, address, phone, closed_day, capacity, pin, blocked_dates, capacity_overrides)
values
  ('steglitz',   'tonys', 'Tony''s Pizzeria & Ristorante', 'Berlin (Steglitz)', 'Albrechtstr. 80, 12167 Berlin',        '030 53798911',   1,    60, '1111', '[]', '[]'),
  ('stahnsdorf', 'tonys', 'Tony''s Pizzeria Stahnsdorf',   'Stahnsdorf',        'Potsdamer Allee 109a, 14532 Stahnsdorf','0176 24139753',  2,    80, '2222', '[]', '[]'),
  ('airport',    'tonys', 'Tony''s Pizzeria Airport',      'Schönefeld (BER)',  'Am Flughafen 13, 12529 Schönefeld',    '030 33930777',   null, 70, '3333', '[]', '[]')
on conflict (id) do nothing;

-- closed_day: null = open every day, 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
-- Stahnsdorf is set to 2 (Tuesday) to match the live site's "Dienstag geschlossen".

-- NOTE: privacy_policy_url above is a placeholder. You'll need to actually
-- publish the Datenschutzerklärung as a page on tonysristorante.de (or
-- wherever makes sense) at that address before going live — see the
-- Datenschutzerklaerung.md file for the text to publish there.

-- NOTE ON RETENTION: this schema does not auto-delete old bookings. Decide
-- a retention period (see Datenschutzerklaerung.md §6) and either delete
-- old rows manually/periodically, or ask for a scheduled cleanup job later.

-- MIGRATION: if you already ran this file once (before the "lang" column
-- existed on bookings), run this line too:
--
--   alter table bookings add column if not exists lang text not null default 'en';

-- MIGRATION: if you already ran this file before capacity_overrides
-- changed from a whole-day-only object ('{}') to a list that supports
-- specific time windows ('[]'), run this one line to reset any existing
-- (empty, since no overrides had been set yet) values to the new format:
--
--   update branches set capacity_overrides = '[]'::jsonb where capacity_overrides = '{}'::jsonb;
--
-- (If you'd already added real overrides using the old whole-day format,
-- let me know and I'll write a proper data-preserving migration instead
-- of this reset.)
