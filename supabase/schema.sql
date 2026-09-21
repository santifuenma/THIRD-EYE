-- THIRD EYE — esquema de Supabase.
-- Pegar entero en Supabase Dashboard > SQL Editor > Run.
-- Es idempotente: se puede volver a ejecutar sin romper nada.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tabla de fotos (solo metadatos; los archivos viven en Storage)
-- ---------------------------------------------------------------------------
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  location text not null check (char_length(location) between 1 and 80),
  taken_at date,
  device text check (device is null or char_length(device) between 1 and 60),
  storage_path text not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  blur_data_url text,
  bytes integer,
  created_at timestamptz not null default now()
);

create index if not exists photos_created_at_idx on public.photos (created_at desc);

-- Migracion: antes se guardaba ademas una miniatura. Ahora hay una sola
-- version de cada foto y Vercel genera los tamanos que pide cada pantalla.
alter table public.photos drop column if exists thumb_path;

-- Migracion: fecha de captura y camara, que se leen del EXIF al subir.
alter table public.photos add column if not exists taken_at date;
alter table public.photos add column if not exists device text;

alter table public.photos enable row level security;

-- La galeria es publica: cualquiera puede leer.
drop policy if exists "Photos are publicly readable" on public.photos;
create policy "Photos are publicly readable"
  on public.photos
  for select
  to anon, authenticated
  using (true);

-- Escribir solo tu, y solo tus propias filas.
drop policy if exists "Owner can insert photos" on public.photos;
create policy "Owner can insert photos"
  on public.photos
  for insert
  to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "Owner can update photos" on public.photos;
create policy "Owner can update photos"
  on public.photos
  for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "Owner can delete photos" on public.photos;
create policy "Owner can delete photos"
  on public.photos
  for delete
  to authenticated
  using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- Bucket de Storage
-- Limite de 15 MB por archivo: las fotos se suben ya comprimidas desde el
-- navegador (WebP, lado mayor 3000 px), asi que rondan 400 KB - 1 MB.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 15728640, array['image/webp', 'image/jpeg'])
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read of photos bucket" on storage.objects;
create policy "Public read of photos bucket"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'photos');

drop policy if exists "Owner can upload photos" on storage.objects;
create policy "Owner can upload photos"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'photos');

drop policy if exists "Owner can delete photos" on storage.objects;
create policy "Owner can delete photos"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'photos');
