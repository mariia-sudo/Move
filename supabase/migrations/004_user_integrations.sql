create table if not exists public.user_integrations (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  provider text not null,
  provider_user_id text,
  access_token text,         -- Huami app token
  token_data jsonb default '{}', -- service_token, device_id
  last_sync_at timestamptz,
  sync_status text default 'idle', -- idle | connected | syncing | synced | error
  sync_error text,
  records_synced integer default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (user_id, provider)
);

alter table public.user_integrations enable row level security;

create policy "Users manage own integrations"
  on public.user_integrations for all using (auth.uid() = user_id);
