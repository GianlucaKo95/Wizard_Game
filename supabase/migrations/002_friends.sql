-- ════════════════════════════════════════════════════════════════
-- 002_friends.sql — Freundesliste + Raum-Einladungen
--
-- Fügt zwei Tabellen hinzu:
--   - friends: eine Zeile pro Personenpaar (requester/addressee),
--     status 'pending' bis die addressee-Seite annimmt ('accepted').
--     Ablehnen/Entfernen ist ein Delete, kein Statuswechsel.
--   - room_invites: einmalige Einladung eines bestätigten Freundes in
--     einen laufenden Warteraum. Wird beim Annehmen/Ablehnen direkt
--     gelöscht statt archiviert.
--
-- Voraussetzung: 000_full_reset.sql wurde bereits ausgeführt.
-- ════════════════════════════════════════════════════════════════

create table public.friends (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending','accepted')),
  created_at   timestamptz default now(),
  check (requester_id <> addressee_id)
);

-- Genau eine Zeile pro Personenpaar, unabhängig davon wer zuerst angefragt hat.
create unique index friends_pair_unique on public.friends
  (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

alter table public.friends enable row level security;

create policy "friends_select" on public.friends for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "friends_insert" on public.friends for insert
  with check (auth.uid() = requester_id);

-- Nur die angefragte Seite darf eine Anfrage annehmen (pending -> accepted).
create policy "friends_update" on public.friends for update
  using (auth.uid() = addressee_id)
  with check (auth.uid() = addressee_id);

-- Beide Seiten dürfen eine Anfrage ablehnen/zurückziehen oder die
-- Freundschaft wieder auflösen.
create policy "friends_delete" on public.friends for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

alter publication supabase_realtime add table public.friends;

-- ─── Raum-Einladungen ─────────────────────────────────────────────
create table public.room_invites (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.rooms(id) on delete cascade,
  room_code     text not null,
  from_user_id  uuid not null references public.profiles(id) on delete cascade,
  from_username text not null,
  to_user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at    timestamptz default now(),
  check (from_user_id <> to_user_id)
);

-- Höchstens eine offene Einladung pro Raum/Empfänger-Paar.
create unique index room_invites_unique on public.room_invites (room_id, to_user_id);
create index room_invites_to_idx on public.room_invites (to_user_id);

alter table public.room_invites enable row level security;

create policy "invites_select" on public.room_invites for select
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

-- Nur an bestätigte Freunde einladbar.
create policy "invites_insert" on public.room_invites for insert
  with check (
    auth.uid() = from_user_id
    and exists (
      select 1 from public.friends f
      where f.status = 'accepted'
        and (
          (f.requester_id = auth.uid() and f.addressee_id = room_invites.to_user_id)
          or (f.requester_id = room_invites.to_user_id and f.addressee_id = auth.uid())
        )
    )
  );

-- Annehmen/Ablehnen entfernt die Zeile direkt, kein Statuswechsel nötig.
create policy "invites_delete" on public.room_invites for delete
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

alter publication supabase_realtime add table public.room_invites;
