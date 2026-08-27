-- ════════════════════════════════════════════════════════════════
-- delete_user.sql — Nutzer inkl. aller App-Daten sauber löschen
--
-- Löscht einen Auth-Nutzer über die Supabase SQL-Editor-Konsole.
-- auth.users -> profiles kaskadiert bereits (siehe 000_full_reset.sql),
-- aber rooms.host_id, room_players.user_id, game_stats.user_id und
-- manual_game_players.user_id haben KEINE ON DELETE-Regel (dasselbe
-- Muster, das schon den Room-Cleanup-Job blockiert hat, siehe Migration
-- 019_game_stats_room_fk_set_null.sql) - deshalb schlägt das Löschen
-- über die Dashboard-UI mit einem Fremdschlüssel-Fehler fehl, sobald der
-- Nutzer irgendwo referenziert wird.
--
-- Nutzung: E-Mail unten eintragen, dann im Supabase SQL Editor
-- ausführen. Läuft in einer Transaktion - bei einem Fehler wird nichts
-- übernommen.
-- ════════════════════════════════════════════════════════════════

begin;

do $$
declare
  target_id uuid;
  target_email text := 'REPLACE_ME@example.com'; -- <-- hier die E-Mail des zu löschenden Nutzers eintragen
begin
  select id into target_id from auth.users where email = target_email;

  if target_id is null then
    raise exception 'Kein Nutzer mit E-Mail % gefunden', target_email;
  end if;

  raise notice 'Lösche Nutzer % (%)', target_email, target_id;

  -- Räume, die dieser Nutzer gehostet hat, bleiben für die übrigen
  -- Mitspieler bestehen - host_id ist nullable, also nur entkoppeln,
  -- nicht den ganzen Raum löschen.
  update public.rooms set host_id = null where host_id = target_id;

  -- Wie ein normales Verlassen des Raums - room_players.room_id
  -- kaskadiert bereits von rooms, hier geht es um Räume, die NICHT
  -- gleichzeitig gelöscht werden.
  delete from public.room_players where user_id = target_id;

  -- Eigene Statistik-Historie - das sind die persönlichen Datensätze
  -- dieses Nutzers, nicht die anderer Mitspieler (die haben ihre
  -- eigenen game_stats-Zeilen).
  delete from public.game_stats where user_id = target_id;

  -- Nicht-Host-Teilnahme an fremden Rechenblock-Spielen: auf "Gast"
  -- entkoppeln (user_id ist bereits nullable genau für diesen Fall,
  -- siehe 010_manual_games.sql), damit die Partie für Host und übrige
  -- Mitspieler erhalten bleibt.
  update public.manual_game_players set user_id = null where user_id = target_id;

  -- Alles andere (profiles, friends, room_invites, room_spectators,
  -- push_subscriptions, selbst gehostete manual_games) kaskadiert schon
  -- korrekt von auth.users, siehe 002_friends.sql/008_push_subscriptions.sql/
  -- 010_manual_games.sql/014_spectator_mode.sql.
  delete from auth.users where id = target_id;

  raise notice 'Nutzer % gelöscht', target_email;
end $$;

commit;
