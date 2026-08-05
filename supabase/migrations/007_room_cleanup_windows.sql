-- ════════════════════════════════════════════════════════════════
-- 007_room_cleanup_windows.sql — getrennte Fenster für Warteraum vs.
-- laufendes Spiel
--
-- 006_room_presence_cleanup.sql hatte ein einziges 30-Minuten-Fenster
-- für alle Räume. Das passt für einen nie gestarteten Warteraum, ist
-- aber zu knapp für ein laufendes Spiel: dort greift der Fast-Path
-- (Presence erkennt "kein Mensch mehr verbunden") nur, wenn noch ein
-- anderer Mensch da war, der das melden konnte - bei einem Solo-
-- Mensch-gegen-KI-Spiel verlässt niemand sonst den Presence-Channel,
-- also bleibt room_players.connected auf dem letzten bekannten Stand
-- hängen und der Raum landet im allgemeinen Sicherheitsnetz. Ein
-- pausiertes Solospiel nach 30 Minuten zu löschen ist zu aggressiv;
-- 2 Stunden sind ein angemesseneres Netz für diesen Fall.
--
-- Voraussetzung: 006_room_presence_cleanup.sql wurde bereits
-- ausgeführt.
-- ════════════════════════════════════════════════════════════════

create or replace function public.cleanup_stale_rooms() returns void
language plpgsql security definer set search_path = public as $$
declare
  lobby_inactive_minutes constant int := 30;    -- nie gestarteter Warteraum
  active_inactive_minutes constant int := 120;  -- allgemeines Netz für alles andere
  abandoned_minutes constant int := 2;          -- Fast-Path: Presence meldet "alle weg"
begin
  -- Warteraum, der nie gestartet wurde.
  delete from public.rooms r
  where r.phase = 'lobby'
    and r.updated_at < now() - make_interval(mins => lobby_inactive_minutes);

  -- Laufendes Spiel, aber kein einziger menschlicher Spieler mehr verbunden
  -- (per Presence erkannt).
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

  -- Sicherheitsnetz für alles, was die beiden Fälle oben nicht erwischen:
  -- gameEnd-Räume, und laufende Spiele, bei denen Presence den letzten
  -- verbliebenen Menschen nicht erkennen konnte (z.B. Solo gegen KI).
  delete from public.rooms
  where updated_at < now() - make_interval(mins => active_inactive_minutes);
end $$;
