-- daily_logs: track per-day alcohol/smoking intake
create table if not exists public.daily_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null default current_date,
  type text check (type in ('alcohol', 'smoking')) not null,
  notes text,
  created_at timestamptz default now() not null,
  unique (user_id, date, type)
);

alter table public.daily_logs enable row level security;

create policy "Users manage own daily logs"
  on public.daily_logs for all using (auth.uid() = user_id);

create index daily_logs_user_date_idx
  on public.daily_logs (user_id, date desc);
