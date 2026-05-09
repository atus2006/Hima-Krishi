-- Hima Krishi: farmers table
create table farmers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  village text not null,
  district text default 'East Sikkim',
  crop text not null,
  quantity_kg integer not null,
  ready_date date,
  phone text,
  certification_status text default 'Sikkim Organic Mission Certified',
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Enable public read access for buyer portal
alter table farmers enable row level security;
create policy "Public read" on farmers for select using (true);
create policy "Service insert" on farmers for insert
  with check (true);

-- Sample data from real Sikkim farmers (replace with real interviews)
insert into farmers (name, village, crop, quantity_kg, ready_date, phone)
values
  ('Tenzin Lepcha', 'Mangan', 'Large Cardamom', 120, '2026-06-01', null),
  ('Dawa Sherpa', 'Ravangla', 'Ginger', 80, '2026-05-25', null),
  ('Pema Tamang', 'Namchi', 'Turmeric', 60, '2026-06-10', null);
