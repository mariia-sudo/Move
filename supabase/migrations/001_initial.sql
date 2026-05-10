-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  date_of_birth date,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Workouts table
create table if not exists public.workouts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  sport_type text check (sport_type in ('weightlifting', 'running', 'squash', 'padel')) not null,
  date date not null,
  notes text,
  duration_minutes integer,
  created_at timestamptz default now() not null
);

-- Workout sets (weightlifting)
create table if not exists public.workout_sets (
  id uuid default uuid_generate_v4() primary key,
  workout_id uuid references public.workouts(id) on delete cascade not null,
  exercise text not null,
  sets integer not null default 1,
  reps integer not null,
  weight_kg numeric(5,2),
  created_at timestamptz default now() not null
);

-- Workout cardio (running)
create table if not exists public.workout_cardio (
  id uuid default uuid_generate_v4() primary key,
  workout_id uuid references public.workouts(id) on delete cascade not null,
  distance_km numeric(6,2) not null,
  duration_seconds integer not null,
  avg_pace_per_km integer, -- seconds per km
  avg_heart_rate integer,
  created_at timestamptz default now() not null
);

-- Workout racket sports (squash/padel)
create table if not exists public.workout_racket (
  id uuid default uuid_generate_v4() primary key,
  workout_id uuid references public.workouts(id) on delete cascade not null,
  opponent text,
  score text,
  result text check (result in ('win', 'loss', 'draw')),
  notes text,
  created_at timestamptz default now() not null
);

-- Cycle logs
create table if not exists public.cycle_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  period_start_date date not null,
  cycle_length_days integer not null default 28,
  period_length_days integer not null default 5,
  notes text,
  created_at timestamptz default now() not null
);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_sets enable row level security;
alter table public.workout_cardio enable row level security;
alter table public.workout_racket enable row level security;
alter table public.cycle_logs enable row level security;

-- RLS Policies
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

create policy "Users can manage own workouts" on public.workouts for all using (auth.uid() = user_id);

create policy "Users can manage own workout sets" on public.workout_sets for all
  using (exists (select 1 from public.workouts where id = workout_id and user_id = auth.uid()));

create policy "Users can manage own workout cardio" on public.workout_cardio for all
  using (exists (select 1 from public.workouts where id = workout_id and user_id = auth.uid()));

create policy "Users can manage own workout racket" on public.workout_racket for all
  using (exists (select 1 from public.workouts where id = workout_id and user_id = auth.uid()));

create policy "Users can manage own cycle logs" on public.cycle_logs for all using (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Indexes
create index if not exists workouts_user_id_date_idx on public.workouts(user_id, date desc);
create index if not exists workout_sets_workout_id_idx on public.workout_sets(workout_id);
create index if not exists workout_cardio_workout_id_idx on public.workout_cardio(workout_id);
create index if not exists workout_racket_workout_id_idx on public.workout_racket(workout_id);
create index if not exists cycle_logs_user_id_date_idx on public.cycle_logs(user_id, period_start_date desc);
