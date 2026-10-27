-- GARUDAX backend schema for Supabase (run once in SQL Editor).
create extension if not exists pgcrypto;

create table if not exists public.garudax_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_garudax_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.garudax_admins where user_id = auth.uid()); $$;
grant execute on function public.is_garudax_admin() to anon, authenticated;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'printing' check (category in ('printing','photocopy','photo','colouring','other')),
  description text not null default '',
  price numeric(10,2) not null default 0 check (price >= 0),
  unit_label text not null default 'page',
  sizes jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  image_url text,
  book_file_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null default ('GX-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  customer_name text not null,
  phone text not null,
  address text not null,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  size text not null,
  quantity integer not null check (quantity between 1 and 5000),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  total_price numeric(12,2) not null check (total_price >= 0),
  payment_method text not null check (payment_method in ('cod','upi_on_delivery')),
  notes text not null default '',
  file_path text,
  status text not null default 'pending' check (status in ('pending','confirmed','printing','out_for_delivery','delivered','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.garudax_admins enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;

drop policy if exists "admins can read own admin record" on public.garudax_admins;
create policy "admins can read own admin record" on public.garudax_admins for select to authenticated using (user_id = auth.uid());

drop policy if exists "public can read active products" on public.products;
create policy "public can read active products" on public.products for select to anon, authenticated using (active = true or public.is_garudax_admin());
drop policy if exists "admins manage products" on public.products;
create policy "admins manage products" on public.products for all to authenticated using (public.is_garudax_admin()) with check (public.is_garudax_admin());

drop policy if exists "visitors can place orders" on public.orders;
create policy "visitors can place orders" on public.orders for insert to anon, authenticated with check (status = 'pending');
drop policy if exists "admins read orders" on public.orders;
create policy "admins read orders" on public.orders for select to authenticated using (public.is_garudax_admin());
drop policy if exists "admins update orders" on public.orders;
create policy "admins update orders" on public.orders for update to authenticated using (public.is_garudax_admin()) with check (public.is_garudax_admin());

-- Storage buckets: create these in Supabase Storage if not created by dashboard.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('catalog','catalog',true,8388608,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('order-files','order-files',false,15728640,array['application/pdf','image/jpeg','image/png','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('book-files','book-files',false,26214400,array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists "public can view catalogue images" on storage.objects;
create policy "public can view catalogue images" on storage.objects for select to anon, authenticated using (bucket_id = 'catalog');
drop policy if exists "admins upload catalogue images" on storage.objects;
create policy "admins upload catalogue images" on storage.objects for insert to authenticated with check (bucket_id = 'catalog' and public.is_garudax_admin());
drop policy if exists "admins update catalogue images" on storage.objects;
create policy "admins update catalogue images" on storage.objects for update to authenticated using (bucket_id = 'catalog' and public.is_garudax_admin()) with check (bucket_id = 'catalog' and public.is_garudax_admin());
drop policy if exists "admins delete catalogue images" on storage.objects;
create policy "admins delete catalogue images" on storage.objects for delete to authenticated using (bucket_id = 'catalog' and public.is_garudax_admin());

drop policy if exists "visitors upload order files" on storage.objects;
create policy "visitors upload order files" on storage.objects for insert to anon, authenticated with check (bucket_id = 'order-files');
drop policy if exists "admins read order files" on storage.objects;
create policy "admins read order files" on storage.objects for select to authenticated using (bucket_id = 'order-files' and public.is_garudax_admin());
drop policy if exists "admins upload book files" on storage.objects;
create policy "admins upload book files" on storage.objects for insert to authenticated with check (bucket_id = 'book-files' and public.is_garudax_admin());
drop policy if exists "admins read book files" on storage.objects;
create policy "admins read book files" on storage.objects for select to authenticated using (bucket_id = 'book-files' and public.is_garudax_admin());
drop policy if exists "admins update book files" on storage.objects;
create policy "admins update book files" on storage.objects for update to authenticated using (bucket_id = 'book-files' and public.is_garudax_admin()) with check (bucket_id = 'book-files' and public.is_garudax_admin());
drop policy if exists "admins delete book files" on storage.objects;
create policy "admins delete book files" on storage.objects for delete to authenticated using (bucket_id = 'book-files' and public.is_garudax_admin());
