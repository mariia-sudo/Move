create table if not exists public.body_measurements (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  weight_kg numeric(5,2),
  body_fat_percent numeric(5,2),
  muscle_mass_kg numeric(5,2),
  bone_mass_kg numeric(5,2),
  water_percent numeric(5,2),
  bmi numeric(5,2),
  visceral_fat integer,
  created_at timestamptz default now() not null,
  unique (user_id, date)
);

alter table public.body_measurements enable row level security;

create policy "Users can manage own measurements"
  on public.body_measurements for all using (auth.uid() = user_id);

create index if not exists body_measurements_user_date_idx
  on public.body_measurements (user_id, date desc);
