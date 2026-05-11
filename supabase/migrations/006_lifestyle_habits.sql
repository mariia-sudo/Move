alter table public.profiles
  add column if not exists smoking      text check (smoking      in ('never','sometimes','regularly')),
  add column if not exists alcohol      text check (alcohol      in ('never','holidays','regularly')),
  add column if not exists sleep_quality text check (sleep_quality in ('under6','6to8','over8')),
  add column if not exists stress_level text check (stress_level in ('low','medium','high')),
  add column if not exists water_intake text check (water_intake in ('under1l','1to2l','over2l'));
