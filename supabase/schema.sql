-- Run this complete script in Supabase SQL Editor for a fresh project.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('customer','owner')),
  full_name text not null default '',
  phone text not null default '',
  delivery_address text not null default '',
  created_at timestamptz not null default now()
);

-- Keep the profile table compatible if an earlier version of the schema was run.
alter table public.profiles add column if not exists full_name text not null default '';
alter table public.profiles add column if not exists phone text not null default '';
alter table public.profiles add column if not exists delivery_address text not null default '';

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Other',
  size text,
  condition text not null default 'Very good',
  price numeric(10,2) not null check (price >= 0),
  image_url text,
  description text,
  status text not null default 'available' check (status in ('available','sold','hidden')),
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null,
  contact_number text not null,
  delivery_address text not null,
  items jsonb not null,
  total numeric(10,2) not null check (total >= 0),
  status text not null default 'pending' check (status in ('pending','confirmed','packed','shipped','completed','cancelled')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;

create or replace function public.is_store_owner()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'owner'); $$;

-- Create a customer profile automatically after sign-up. New accounts are never owners.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, phone, delivery_address)
  values (
    new.id,
    'customer',
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(new.raw_user_meta_data->>'phone',''),
    coalesce(new.raw_user_meta_data->>'delivery_address','')
  ) on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Product listings are empty until the owner adds them. Customers can only view available listings.
drop policy if exists "Public can view available products" on public.products;
create policy "Public can view available products" on public.products for select using (status = 'available' or public.is_store_owner());
drop policy if exists "Owner manages products" on public.products;
create policy "Owner manages products" on public.products for all using (public.is_store_owner()) with check (public.is_store_owner());

-- Customers can read and update their own contact details, but cannot change their role.
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles for select using (id = auth.uid() or public.is_store_owner());
drop policy if exists "Users update own contact details" on public.profiles;
create policy "Users update own contact details" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and role = 'customer');
drop policy if exists "Owner manages profiles" on public.profiles;
create policy "Owner manages profiles" on public.profiles for all using (public.is_store_owner()) with check (public.is_store_owner());

-- A signed-in customer may create an order only for their own account and may view only their orders.
drop policy if exists "Customers create own orders" on public.orders;
create policy "Customers create own orders" on public.orders for insert with check (customer_id = auth.uid());
drop policy if exists "Customers view own orders" on public.orders;
create policy "Customers view own orders" on public.orders for select using (customer_id = auth.uid() or public.is_store_owner());
drop policy if exists "Owner updates orders" on public.orders;
create policy "Owner updates orders" on public.orders for update using (public.is_store_owner()) with check (public.is_store_owner());
drop policy if exists "Owner deletes orders" on public.orders;
create policy "Owner deletes orders" on public.orders for delete using (public.is_store_owner());

-- IMPORTANT: After you sign up with your own owner email, run this once with your actual email
-- to grant your account owner access. Never give customers this SQL access.
-- update public.profiles set role = 'owner' where id = (select id from auth.users where email = 'YOUR_OWNER_EMAIL');
