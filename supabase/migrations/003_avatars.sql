-- ════════════════════════════════════════════════════════════════
-- 003_avatars.sql — Profilbilder
--
-- Fügt eine avatar_url-Spalte zu profiles hinzu und einen öffentlich
-- lesbaren Storage-Bucket, in den jeder User nur seine eigene Datei
-- unter <user_id>/avatar.jpg hochladen/überschreiben/löschen darf.
--
-- Voraussetzung: 000_full_reset.sql wurde bereits ausgeführt.
-- ════════════════════════════════════════════════════════════════

alter table public.profiles add column avatar_url text;

-- profiles_select (using (true)) deckt das Lesen von avatar_url für
-- alle Profile bereits ab - keine weitere Policy nötig.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

alter table storage.objects enable row level security;

create policy "avatars_public_read" on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_own_write" on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "avatars_own_update" on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "avatars_own_delete" on storage.objects for delete
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
