-- Expand sport_type check constraint to include 10 new sports
alter table public.workouts
  drop constraint if exists workouts_sport_type_check;

alter table public.workouts
  add constraint workouts_sport_type_check
  check (sport_type in (
    'weightlifting', 'running',    'squash',     'padel',
    'yoga',          'swimming',   'cycling',    'football',
    'basketball',    'volleyball', 'boxing',     'crossfit',
    'tennis',        'hockey'
  ));
