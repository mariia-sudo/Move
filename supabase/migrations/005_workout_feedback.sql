create table if not exists public.workout_feedback (
  id uuid default uuid_generate_v4() primary key,
  workout_id uuid references public.workouts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  energy_level integer check (energy_level between 1 and 10),
  mood text check (mood in ('tired', 'good', 'great', 'overtrained')),
  pain_areas text[] not null default '{}',
  notes text,
  created_at timestamptz default now() not null,
  unique (workout_id)
);

alter table public.workout_feedback enable row level security;

create policy "Users manage own feedback"
  on public.workout_feedback for all using (auth.uid() = user_id);

create index workout_feedback_user_date_idx
  on public.workout_feedback (user_id, created_at desc);
