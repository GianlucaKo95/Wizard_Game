# Datenbank

Postgres-Schema, Views, Row-Level-Security-Modell und die vollständige Migrationshistorie. Für den größeren architektonischen Kontext siehe [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Tabellen

| Tabelle | Zweck |
|---|---|
| `profiles` | Ein Profil pro Auth-Nutzer (`username`, `created_at`), wird per Trigger (`handle_new_user`) automatisch bei der Registrierung angelegt |
| `rooms` | Ein laufendes/wartendes Spiel: Phase, Runde, Trumpf, aktueller Stich, alle "pending_*"-Zwischenzustände für Sonderkarten-Interaktionen (Jongleur-Tausch, Gleis-9¾-Korrektur, Hexen-Tausch, …), Log |
| `room_decks` | Das gemischte Deck eines Raums – **nie** in Realtime/an Clients exponiert, sonst wären künftige Karten vorhersagbar |
| `room_players` | Ein Sitzplatz in einem Raum: Hand (JSONB), Gebot, Stiche, Punktestand, KI-Flag, Verbindungsstatus |
| `round_history` | Ergebnisse pro abgeschlossener Runde eines Online-Spiels (JSONB-Array `{playerIndex, bid, got, delta}`) – wird beim Room-Cleanup mitgelöscht (siehe unten) |
| `game_stats` | Ein dauerhafter Datensatz pro menschlichem Spieler und abgeschlossener Partie (online oder Rechenblock) – Grundlage für `user_stats` und die "Letzte Partien"-Liste. Übersteht Room-Cleanup, siehe [Fallstricke](#game_stats-verknüpfung-und-ihre-fallstricke) unten |
| `room_messages` | Textchat-Verlauf pro Raum |
| `friends` | Eine Zeile pro Personenpaar (`requester_id`/`addressee_id`), Status `pending`/`accepted` |
| `room_invites` | Einmalige Einladung eines bestätigten Freundes in einen laufenden Warteraum |
| `push_subscriptions` | Web-Push-Abos (Endpoint + Keys) für "Du bist dran"-Benachrichtigungen |
| `manual_games` | Eine Rechenblock-Partie (Host, Erstellungs-/Abschlusszeitpunkt) |
| `manual_game_players` | Roster einer Rechenblock-Partie: Sitzindex, Anzeigename, optional verknüpfter `user_id` (`null` = Gast) |
| `manual_game_rounds` | Rundenergebnisse einer Rechenblock-Partie (JSONB-Array `{playerIndex, name, bid, got, delta}` – **inklusive Namen**, wichtig für RLS, siehe unten) |
| `room_spectators` | Wer beobachtet gerade welchen Raum (Zuschauer-Modus) |

## Views

| View | Zweck |
|---|---|
| `room_players_view` | Die einzige Quelle, aus der Clients Mitspielerdaten lesen dürfen: maskiert `hand` zu `visible_hand` (nur die eigene Hand ist sichtbar, für alle anderen `null` bzw. nur `hand_count`) und erzwingt `visible_hand = null` auch für Zuschauer, unabhängig von sonstigen Ausnahmen |
| `user_stats` | Aggregiert `game_stats` pro Nutzer: `games_played`, `games_won`, `avg_score`, `avg_placement`, `bid_accuracy_pct` (siehe Migration 021 unten). `security_invoker = true`, dadurch gilt beim Lesen die RLS des Aufrufers, nicht die des View-Erstellers |
| `friends_active_rooms` | Discovery-Query für "Freunde spielen gerade": Räume mit mindestens einem akzeptierten Freund als menschlichem Spieler, ohne Phasenfilter (Warteraum bis laufendes Spiel), aber ohne bereits beendete (`gameEnd`) Partien |

## Row-Level-Security-Modell

Grundprinzip: **jede** Tabelle hat RLS aktiviert; was ein Client lesen/schreiben darf, steht explizit als Policy da, nicht implizit im Frontend-Code.

- **Handkarten-Schutz**: Rohes `room_players.hand` ist nie direkt für andere lesbar gedacht – der Client liest ausschließlich über `room_players_view`, deren `visible_hand`-Spalte den Wert nur für die eigene Zeile durchreicht.
- **Zuschauer**: `room_players_view` erweitert die Mitgliedschaftsprüfung um `room_spectators`, erzwingt aber `visible_hand = null` für sie explizit – Zuschauen darf niemals versehentlich echte Karten zeigen.
- **Breite Lese-Policies mit Absicht**: `game_stats` (`gs_select`) und `profiles`/`user_stats` sind für jeden authentifizierten Nutzer lesbar, nicht nur für den Besitzer – das ist die Grundlage für Freundesprofile und Statistik-Vergleiche und ist bewusst so gewählt, keine Regression.
- **Rechenblock-Sichtbarkeit ist gestaffelt**: Host sieht/ändert alles; ein verlinkter Nicht-Host-Teilnehmer sieht in `manual_game_players` **nur seine eigene** Roster-Zeile, aber in `manual_game_rounds` **alle** Runden vollständig (über die Security-Definer-Helper-Funktion `is_manual_game_player`, siehe unten) – ein unbeteiligter Nutzer sieht nichts. Deshalb rekonstruiert der Client Rechenblock-Ranglisten bewusst aus `manual_game_rounds.results` (das jeden Spielernamen selbst enthält) statt über einen Join auf `manual_game_players` – letzteres würde für Nicht-Host-Betrachter auf 1 Spieler zusammenschrumpfen.
- **RLS-Helper in eigenem Schema**: `is_manual_game_host`/`is_manual_game_player` liegen in einem `private`-Schema statt in `public` (siehe Migration 013 unten) – PostgREST exponiert nur `public` als REST-Endpunkte, eine reine RLS-Hilfsfunktion soll nicht direkt aufrufbar sein.
- **Schreibende Sonderrechte laufen über die Edge Function**: `game_stats`-Inserts sind ausschließlich der `service_role` erlaubt (`gs_insert`) – nur die Edge Function darf Statistik-Zeilen anlegen, ein Client kann sich nicht selbst einen Sieg gutschreiben.
- **Performance**: `auth.uid()`/`auth.role()` werden in Policies konsequent als `(select auth.uid())` verpackt (verhindert Neuauswertung pro Zeile), mehrere permissive Policies auf derselben Tabelle/Aktion wurden zu je einer zusammengefasst, alle Fremdschlüssel haben einen begleitenden Index (siehe Migration 012 unten).

## `game_stats`-Verknüpfung und ihre Fallstricke

`game_stats` ist die einzige *dauerhafte* Quelle für Statistik/Rangliste – `round_history` (Online-Spiele) wird gelöscht, sobald der zugehörige Raum aufgeräumt wird, `manual_game_rounds` dagegen nicht (nichts räumt Rechenblock-Partien automatisch auf). Wie man "welche `game_stats`-Zeilen gehören zur selben Partie" beantwortet, hat sich im Projektverlauf mehrfach geändert – wichtig für alle, die künftig an der Statistik-Anzeige arbeiten:

1. **Rechenblock-Partien**: verknüpft über `manual_game_id` (seit Migration 017 unten). Partien von *davor* haben dieses Feld `null` und können nicht mehr automatisch zugeordnet werden.
2. **Online-Partien, deren Raum noch existiert**: verknüpft über `room_id`.
3. **Online-Partien, deren Raum längst aufgeräumt wurde**: `room_id` wird dabei `ON DELETE SET NULL` (siehe Migration 019 unten) – ohne Gegenmaßnahme geht damit die einzige Verbindung zwischen den Spieler-Zeilen dieser Partie verloren. Seit Migration 022 (unten) bekommt deshalb jede Online-Partie zusätzlich eine `game_session_id`, die unabhängig von `rooms` ist und den Cleanup übersteht.
4. **Alte Online-Partien von vor `game_session_id`, deren Raum bereits aufgeräumt wurde**: haben `room_id = null` **und** `game_session_id = null` – für diese bleibt nur eine Best-Effort-Heuristik über zeitliche Nähe (`played_at`) und gleiche `total_rounds`, die nur dann etwas anzeigt, wenn die Kandidaten eine lückenlose, eindeutige Platzierungsliste (1..N) ergeben. Sonst zeigt die UI ehrlich "Mitspieler-Daten nicht mehr verfügbar" statt zu raten.

Kurz: **`room_id` allein war nie eine dauerhafte Kennung** – jeder Code, der Partien anhand von `game_stats` gruppiert, muss zuerst `manual_game_id`, dann `game_session_id`, dann `room_id` prüfen und erst danach auf die Heuristik zurückfallen (siehe `usePastGames` in `App.tsx`).

## Migrationshistorie

Migrationen liegen unter `supabase/migrations/`, fortlaufend nummeriert (`NNN_beschreibung.sql`), und werden **manuell** (Supabase CLI oder MCP-Tooling) gegen das Projekt angewendet – nicht automatisch über CI. Neue Spalten in `CREATE OR REPLACE VIEW` müssen ans Ende der `SELECT`-Liste, nie mittendrin eingefügt werden (Postgres versucht sonst, eine spätere Spalte "umzubenennen", und bricht ab).

| # | Datei | Zweck |
|---|---|---|
| 000 | `full_reset.sql` | Kompletter Neuaufbau: Kern-Tabellen (`profiles`, `rooms`, `room_players`, `room_decks`, `round_history`, `game_stats`, `room_messages`), `room_players_view`, `user_stats`, RLS-Grundpolicies, Realtime-Publikation |
| 001 | `backfill_profiles.sql` | Fehlende `profiles`-Zeilen für bereits bestehende Auth-Nutzer nachbauen |
| 002 | `friends.sql` | Freundesliste + Raum-Einladungen (`friends`, `room_invites`) |
| 003 | `avatars.sql` | Profilbilder (Storage-Bucket + Policies) |
| 004 | `room_cleanup.sql` | Erste Version des Cronjobs, der inaktive Räume abräumt |
| 005 | `room_membership.sql` | Reconnect über das Backend statt `localStorage` |
| 006 | `room_presence_cleanup.sql` | Verwaiste laufende Spiele früher erkennen (Presence-basiert) |
| 007 | `room_cleanup_windows.sql` | Getrennte Zeitfenster für Warteraum (30 Min), "alle Menschen weg" (2 Min) und allgemeines Sicherheitsnetz (2 Std) |
| 008 | `push_subscriptions.sql` | Web-Push-Anmeldungen für "Du bist dran" |
| 009 | `rainbow7_pass_lock.sql` | Atomarer Kartentausch bei der Jongleur-Sonderkarte (Race-Condition-Fix) |
| 010 | `manual_games.sql` | Digitaler Rechenblock: `manual_games`, `manual_game_players`, `manual_game_rounds` + RLS |
| 011 | `manual_games_rls_recursion_fix.sql` | Behebt "infinite recursion" in den Rechenblock-RLS-Policies |
| 012 | `security_performance_hardening.sql` | Schließt einen `room_players_view`-Cross-Room-Datenleck, macht `user_stats` `security_invoker`, härtet `handle_new_user`/Trigger, verpackt `auth.uid()`/`auth.role()` performant, konsolidiert Policies, ergänzt fehlende FK-Indizes |
| 013 | `move_rls_helpers_to_private_schema.sql` | `is_manual_game_host`/`is_manual_game_player` nach `private` verschoben (kein PostgREST-RPC-Zugriff mehr) |
| 014 | `spectator_mode.sql` | Zuschauer-Modus: `room_spectators`, `room_players_view`-Erweiterung, `friends_active_rooms`-View |
| 015 | `spectator_visibility.sql` | "Niemand wird unbemerkt beobachtet" – Raum-Mitglieder sehen, wer zuschaut |
| 016 | `friends_active_rooms_detail.sql` | Ergänzt `friends_active_rooms` um Editions-/Rundendetails |
| 017 | `game_stats_manual_game_link.sql` | `game_stats.manual_game_id` – macht Rechenblock-Partien für die Statistik-Gruppierung auffindbar |
| 018 | `friends_active_rooms_exclude_gameend.sql` | Schließt bereits beendete Partien aus `friends_active_rooms` aus |
| 019 | `game_stats_room_fk_set_null.sql` | `game_stats.room_id` von einer blockierenden FK auf `ON DELETE SET NULL` – behebt einen Deadlock im Room-Cleanup-Job |
| 020 | `profile_fk_delete_rules.sql` | Nutzerlöschung reparieren: `rooms.host_id` → `SET NULL`, `room_players.user_id`/`game_stats.user_id` → `CASCADE`, `manual_game_players.user_id` → `SET NULL` |
| 021 | `bid_accuracy_hit_rate.sql` | `bid_accuracy_pct` war eine unbeschränkte Ratio (`tricks_won`/`tricks_bid`, konnte >100 % werden) – ersetzt durch eine echte, pro Runde gemessene Trefferquote (`rounds_hit`/`rounds_played`) |
| 022 | `game_session_id.sql` | `game_stats.game_session_id` – überlebt Room-Cleanup, macht Online-Partien dauerhaft gruppierbar (siehe [oben](#game_stats-verknüpfung-und-ihre-fallstricke)) |

## Manuelle Nutzerlöschung

`scripts/delete_user.sql` ist ein eigenständiges, manuell im Supabase-SQL-Editor auszuführendes Skript für eine DSGVO-taugliche Kontolöschung: E-Mail eintragen, Skript läuft in einer Transaktion, entkoppelt gehostete Räume/Rechenblock-Partien statt sie zu löschen (damit sie für die übrigen Mitspieler erhalten bleiben) und löscht anschließend `auth.users` (kaskadiert in `profiles` und alles, was daran mit `ON DELETE CASCADE` hängt).
