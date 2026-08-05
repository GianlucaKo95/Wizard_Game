-- ════════════════════════════════════════════════════════════════
-- 006_room_presence_cleanup.sql — Verwaiste laufende Spiele früher
-- abräumen, allgemeines Inaktivitäts-Fenster auf 30 Minuten verkürzt.
--
-- room_players.connected wurde bisher nur beim Insert auf true
-- gesetzt und nie wieder aktualisiert - reine Deko. Der Client hält
-- den Wert jetzt über die neue "syncPresence" Aktion nach (gespeist
-- aus dem Realtime-Presence-Status des room:<id> Channels), sodass
-- diese Funktion ein laufendes Spiel, in dem wirklich kein Mensch
-- mehr verbunden ist, deutlich schneller abräumen kann als eins, in
-- dem noch jemand nachdenkt.
--
-- Grenze des Fast-Path: verlässt der letzte verbliebene Mensch den
-- Raum, ist niemand mehr da, der das melden könnte (Presence-"leave"
-- geht nur an noch verbundene Clients) - dafür bleibt weiterhin das
-- allgemeine 30-Minuten-Fenster unten als Sicherheitsnetz.
--
-- Voraussetzung: 004_room_cleanup.sql wurde bereits ausgeführt.
-- ════════════════════════════════════════════════════════════════

create or replace function public.cleanup_stale_rooms() returns void
language plpgsql security definer set search_path = public as $$
declare
  inactive_minutes constant int := 30;
  abandoned_minutes constant int := 2; -- Puffer gegen kurze Reloads/Netzwerkaussetzer
begin
  -- Allgemeines Sicherheitsnetz: keinerlei Aktivität mehr.
  delete from public.rooms
  where updated_at < now() - make_interval(mins => inactive_minutes);

  -- Laufendes Spiel, aber kein einziger menschlicher Spieler mehr
  -- verbunden - nicht erst die vollen 30 Minuten abwarten.
  delete from public.rooms r
  where r.phase not in ('lobby', 'gameEnd')
    and r.updated_at < now() - make_interval(mins => abandoned_minutes)
    and exists (
      select 1 from public.room_players rp
      where rp.room_id = r.id and rp.is_ai = false
    )
    and not exists (
      select 1 from public.room_players rp
      where rp.room_id = r.id and rp.is_ai = false and rp.connected = true
    );
end $$;
