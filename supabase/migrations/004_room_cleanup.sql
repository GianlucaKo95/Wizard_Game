-- ════════════════════════════════════════════════════════════════
-- 004_room_cleanup.sql — Räume nach Inaktivität abräumen
--
-- Der Rejoin-Hinweis auf dem Client merkt sich einen Raum jetzt über
-- localStorage statt sessionStorage, überlebt also einen echten
-- Neustart der App. Damit das Zeitfenster zum Wiedereinsteigen nicht
-- endlos lang wird, räumt ein periodischer Job Räume weg, die eine
-- Weile lang nicht mehr angefasst wurden.
--
-- rooms.updated_at wurde bisher nirgends aktualisiert (nur der
-- default now() beim Erstellen) - der Touch-Trigger unten sorgt
-- dafür, dass die Spalte tatsächlich "zuletzt aktiv" bedeutet, sonst
-- hätte der Cleanup-Job kein brauchbares Signal.
--
-- Voraussetzung: 000_full_reset.sql wurde bereits ausgeführt.
-- ════════════════════════════════════════════════════════════════

create or replace function public.touch_room_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists rooms_touch_updated_at on public.rooms;
create trigger rooms_touch_updated_at
  before update on public.rooms
  for each row execute function public.touch_room_updated_at();

-- Löscht Räume, die INACTIVE_MINUTES lang nicht mehr geschrieben
-- wurden. room_players/room_decks/round_history/room_messages/
-- room_invites hängen alle per "on delete cascade" an rooms.id,
-- räumen sich also automatisch mit.
create or replace function public.cleanup_stale_rooms() returns void
language plpgsql security definer set search_path = public as $$
declare
  inactive_minutes constant int := 180; -- 3 Stunden
begin
  delete from public.rooms
  where updated_at < now() - make_interval(mins => inactive_minutes);
end $$;
revoke all on function public.cleanup_stale_rooms from public, anon, authenticated;

create extension if not exists pg_cron with schema extensions;

-- cron.schedule ist ein Upsert über den Job-Namen - erneutes
-- Ausführen dieser Migration legt keinen zweiten Job an.
select cron.schedule('cleanup-stale-rooms', '*/15 * * * *', 'select public.cleanup_stale_rooms();');
