-- ════════════════════════════════════════════════════════════════
-- 008_push_subscriptions.sql — Web-Push-Anmeldungen für "Du bist dran"
--
-- Speichert die Push-Subscriptions, die der Browser beim Aktivieren
-- von Benachrichtigungen zurückgibt (Endpoint + Verschlüsselungs-
-- schlüssel, kein Klartext-Inhalt). Der Client schreibt/löscht seine
-- eigenen Zeilen direkt (RLS), das Versenden selbst passiert
-- ausschließlich über die Service-Role in der Edge Function.
--
-- Voraussetzung: 000_full_reset.sql wurde bereits ausgeführt.
-- ════════════════════════════════════════════════════════════════

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_own" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.push_subscriptions to authenticated;
