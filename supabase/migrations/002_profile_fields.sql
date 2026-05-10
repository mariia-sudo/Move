-- Add fitness profile fields to profiles table
alter table public.profiles
  add column if not exists gender text check (gender in ('male', 'female')),
  add column if not exists age integer check (age > 0 and age < 120),
  add column if not exists weight_kg numeric(5,1) check (weight_kg > 0),
  add column if not exists height_cm integer check (height_cm > 0);
