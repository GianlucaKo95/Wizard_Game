# Architektur

Dieses Dokument beschreibt, wie die einzelnen Teile von Wizzo zusammenspielen. Für Installation/Setup siehe das [Haupt-README](../README.md); für Tabellen/RLS siehe [`DATABASE.md`](DATABASE.md); für lokale Entwicklung siehe [`DEVELOPMENT.md`](DEVELOPMENT.md).

## Grundprinzip: der Server ist die einzige Wahrheit

Der React-Client enthält **keine** Spielregeln, die er selbst durchsetzt. Jede Handlung – eine Karte spielen, ein Gebot abgeben, eine Sonderkarte einsetzen, einen Trumpf wählen – wird als HTTP-Request an eine einzige Supabase Edge Function (`game-action`) geschickt. Diese lädt den aktuellen Raumzustand aus Postgres, validiert die Aktion serverseitig und schreibt das Ergebnis zurück. Der Client bekommt die neuen Daten anschließend über Supabase Realtime (Postgres-Change-Feeds) und rendert sie – er hat nie eine Möglichkeit, sich selbst mehr Punkte, fremde Handkarten oder einen ungültigen Zug zu verschaffen, weil die Autorität dafür serverseitig liegt (zusätzlich abgesichert durch Row Level Security, siehe [`DATABASE.md`](DATABASE.md#row-level-security-modell)).

Das gilt auch für den **Zuschauer-Modus** und den **digitalen Rechenblock** – beide sind eigenständige, bewusst einfachere Pfade statt Sonderfälle in der normalen Spiellogik (siehe unten).

## Komponentenübersicht

```
Browser/PWA (wizard/frontend, React + Vite)
   │
   ├─ REST: callGameAction() ──────────► Edge Function "game-action" (Deno)
   │                                        │
   ├─ Realtime (WebSocket) ◄──────────────┤ liest/schreibt Postgres
   │   rooms, room_players, round_history,  │ (service-role Client, RLS
   │   room_messages, friends, room_invites │  bewusst umgangen für Pfade,
   │                                        │  die fremde Spielerdaten
   ├─ REST (Supabase-JS, mit RLS) ─────────►│  schreiben müssen)
   │   direkte Tabellenzugriffe für alles,  │
   │   was nicht "Spielzug" ist             ▼
   │                                     Postgres (RLS, Views, Trigger)
   │
   ├─ WebRTC (Mesh) ───────► andere Raum-Teilnehmer, vermittelt über
   │                          coturn (TURN-Add-on "Wizzo Sprachchat")
   │                          ICE-Credentials via getIceServers-Aktion
   │
   └─ Web Push ◄──────────── Edge Function versendet (VAPID) bei "du bist dran"
```

Nicht jede Interaktion geht über die Edge Function: Dinge wie Freundschaftsanfragen lesen, das eigene Profil ändern, den Chatverlauf laden oder die eigene Statistik abfragen laufen als normale, RLS-geschützte Supabase-JS-Queries direkt vom Client aus. Die Edge Function wird gezielt dort eingesetzt, wo entweder (a) service-role-Rechte nötig sind (z. B. `game_stats` schreiben, das laut RLS nur die Service-Rolle darf) oder (b) eine Aktion mehrere Spielerzeilen gleichzeitig und serverseitig validiert verändern muss (z. B. eine Karte ausspielen).

## Frontend (`wizard/frontend/src`)

Bewusste Design-Entscheidung: **eine** große `App.tsx` (~5000 Zeilen) statt vieler kleiner Dateien – für ein Projekt dieser Größe mit einem einzelnen/kleinen Entwicklerkreis hat sich das im Verlauf des Projekts als der pragmatischere Schnitt erwiesen (weniger Datei-Sprung-Overhead, ein Screen = eine Funktion, leicht durchsuchbar). Ausgelagert sind nur wirklich unabhängige Bausteine:

| Datei | Inhalt |
|---|---|
| `App.tsx` | Alle Screens/Komponenten (siehe Tabelle unten) + State-Management via React Hooks + Realtime-Subscriptions |
| `supabase.ts` | Supabase-Client-Instanz + `callGameAction()`-Helper (POST an die Edge Function, mit Bearer-Token) |
| `cards.ts` | Statische Daten: Häuser/Themenfarben, Charakternamen pro Kartenwert, Sonderkarten-Definitionen |
| `types.ts` | Gemeinsame TypeScript-Typen (Card, Player, GameState, …) |
| `CardArt.tsx` / `CardView.tsx` | Kartenvisualisierung (SVG/Styling) |
| `Icons.tsx` | Inline-SVG-Icon-Set |
| `cardPreload.ts` | Bild-Preloading für flüssige Kartenanimationen |

### Wichtigste Screens/Komponenten in `App.tsx`

| Komponente | Zweck |
|---|---|
| `AuthScreen` | Login/Registrierung (E-Mail + Passwort über Supabase Auth) |
| `LobbyScreen` | Äußerer Container nach dem Login: Tab-Navigation, Reconnect-Erkennung, Online-Präsenz, Friend-Request-Badges, Raum-Einladungs-Popup, hält den `useVoiceChat`-Hook (überlebt Phasenwechsel innerhalb eines Raums) |
| `GameRoom` | Der eigentliche Spieltisch für aktive Teilnehmer: Sitzplätze, Handkarten, Stichverlauf, Gebote, Chat, Sprachchat-Panel |
| `SpectatorRoom` | Eigenständige, rein lesende Variante von `GameRoom` für den Zuschauer-Modus – bewusst **nicht** `GameRoom` mit einem `isSpectator`-Flag, weil `GameRoom` viele Verzweigungen hat, die implizit einen echten Sitzplatz voraussetzen |
| `FriendsScreen` | Freundesliste, Anfragen, Suche, "Freunde spielen gerade" (mit Zuschauen-Button) |
| `FriendProfileScreen` | Read-only-Profil eines Freundes: Stats + `PastGamesList` |
| `StatsScreen` | Eigene Statistik: Stats + `PastGamesList` |
| `usePastGames` / `PastGamesList` | Gemeinsam genutzter Hook + Komponente für die aufklappbare "Letzte Partien"-Liste (Online- und Rechenblock-Partien, inkl. Best-Effort-Rekonstruktion alter/verwaister Daten – siehe [`DATABASE.md`](DATABASE.md#game_stats-verknüpfung-und-ihre-fallstricke)) |
| `ManualScoreboardScreen` / `ManualGameSetup` / `ManualGamePlay` / `ManualFinishedGameView` | Der digitale Rechenblock: Spieler-Roster (Gast oder verknüpfter Account), Runde-für-Runde-Eingabe, laufende Summen, Ansicht abgeschlossener Partien |
| `ProfileScreen` | Avatar-Upload, Push-Opt-in, Logout |
| `useVoiceChat` | WebRTC-Mesh-Hook: verbindet sich mit jedem anderen menschlichen Teilnehmer einzeln, holt ICE-Server-Credentials über die Edge Function, verwaltet Mute-Zustand |

### Realtime & Polling

Räume abonnieren `postgres_changes` auf `rooms`/`room_players`/`round_history`/`room_messages` (siehe `alter publication supabase_realtime add table ...` in `000_full_reset.sql`). Zusätzlich gibt es an mehreren Stellen einen kurzen Poll-Fallback (z. B. alle 5s), falls eine Realtime-Nachricht durch eine Netzwerkunterbrechung verloren geht – Realtime ist eine Optimierung, keine Konsistenzgarantie.

## Edge Function (`supabase/functions/game-action`)

Ein einziger HTTP-Endpunkt, der Requests per `action`-Feld im JSON-Body dispatcht (`index.ts`, ein großer `switch`). Läuft mit dem **Service-Role-Key** (`SUPABASE_SERVICE_ROLE_KEY`), umgeht also RLS bewusst – jede Aktion muss ihre Berechtigungsprüfung deshalb explizit selbst vornehmen (z. B. "ist der Aufrufer Spieler in diesem Raum", "ist der Aufrufer der Host"). Das ist der Grund, warum diese Datei mit ~1600 Zeilen recht groß ist: Berechtigungslogik, die sonst RLS übernehmen würde, steht hier im Code.

Wichtigste Aktionsgruppen (siehe `case "..."` in `index.ts` für die vollständige Liste):

- **Raum-Lifecycle**: `createRoom`, `joinRoom`, `leaveRoom`, `startGame`, `newGame`
- **Spielzüge**: `bid`, `playCard`, `playSpecial` (Sonderkarten-Effekte), `passCard` (Jongleur-Kartentausch), `chooseTrump`, `chooseWerewolf`, `rainbow9Adjust` (Gleis-9¾-Ansagenkorrektur), `nextRound`, `clearTrick`, `witchRevealDone`, `triggerAI` (KI-Zug anstoßen)
- **Zuschauen**: `spectateRoom`, `leaveSpectating`
- **Präsenz/Infra**: `syncPresence`, `getIceServers` (zeitlich begrenzte, HMAC-signierte TURN-Credentials)
- **Rechenblock**: `finishManualGame` (einzige Rechenblock-Aktion, die über die Edge Function läuft – alles andere schreibt der Client direkt, RLS-geschützt, gegen `manual_games`/`manual_game_players`/`manual_game_rounds`)
- **Soziales**: `sendFriendRequest` (serverseitig, um Username-Enumeration zu verhindern – siehe Kommentar im Code)

### Spielregeln (`logic.ts`)

Reine, seiteneffektfreie Funktionen – Deck-Aufbau pro Edition, Stichgewinner-Ermittlung (inkl. aller Sonderkarten-Sonderfälle wie Bombe/Drache/Fee/Werwolf/Vampir), KI-Bietheuristik und KI-Zugauswahl. Vollständig unit-getestet in `logic_test.ts` (läuft mit `deno test` oder `npx tsx`, siehe [`DEVELOPMENT.md`](DEVELOPMENT.md#tests)). Die Trennung ist bewusst: `index.ts` macht I/O und Berechtigungen, `logic.ts` macht Regeln – Regeländerungen lassen sich so isoliert testen, ohne eine Datenbank zu brauchen.

### Editionen

| Edition | Deck | Besonderheiten |
|---|---|---|
| `classic` | 60 Karten (4 Farben × 13 Werte + 4 Narren + 4 Zauberer) | Das klassische Wizard-Regelwerk |
| `anniversary` ("30 Jahre") | 69 Karten (Classic + 9 Sonderkarten) | Drache (schlägt alles außer Fee), Fee (verliert immer außer gegen Drache), Hexe/Bellatrix (Narr+Karte tauschen), Werwolf/Lupin (legt Stichfarbe für die Runde fest), Vampir/Quirrell (kopiert Trumpf für den Stich), Bombe/Elderstab (annulliert den Stich), Jongleur/George Weasley (Wert 7½, freie Farbe, Karte weitergeben), Gleis 9¾ (Wert 9¾, freie Farbe, Ansage nachträglich ±1), Zauberer-oder-Narr/Ron Weasley (Spieler wählt) |

Die Rundenzahl (`max_rounds`) ergibt sich unabhängig von der Edition aus `Math.floor(60 / Spieleranzahl)` (siehe `startGame`-Aktion).

## Sprachchat (WebRTC + TURN)

- **Mesh-Topologie**: jeder menschliche Teilnehmer baut eine direkte `RTCPeerConnection` zu jedem anderen auf (kein SFU) – für die Zielgröße von bis zu 6 Teilnehmern ausreichend.
- **Signaling** läuft über einen Supabase-Realtime-Channel (Broadcast), nicht über eine eigene Websocket-Infrastruktur.
- **ICE-Server-Credentials** werden nicht statisch verteilt, sondern pro Session über die `getIceServers`-Edge-Function-Aktion angefragt: die Funktion signiert zeitlich begrenzte Zugangsdaten mit dem `TURN_SHARED_SECRET`, das mit dem `shared_secret` des `wizard_turn`-Add-ons übereinstimmen muss. Zuschauer bekommen dieselben echten Credentials (nicht nur STUN), sobald sie erfolgreich `spectateRoom` aufgerufen haben.
- **TURN/STUN-Relay**: das zweite Add-on (`turn/`) ist ein schlankes Alpine-Image, das nur [coturn](https://github.com/coturn/coturn) mit `--use-auth-secret` startet; `host_network: true`, weil UDP-Relay-Ports (`relay_min_port`–`relay_max_port`, Standard 49160–49300) direkt erreichbar sein müssen.
- **Mute** (Text und Sprache) ist rein lokaler, In-Memory-Zustand pro Betrachter – wird nirgends persistiert, betrifft nie, was andere hören/sehen, und setzt sich beim Verlassen des Raums zurück.

## Push-Benachrichtigungen & PWA

- **Web Push**: Opt-in im Profil, Abo wird in `push_subscriptions` gespeichert; die Edge Function versendet bei "du bist dran" signierte VAPID-Push-Nachrichten (`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`-Secrets). Ohne gesetzten `VITE_VAPID_PUBLIC_KEY` im Frontend-Build wird die Option im UI einfach ausgeblendet, statt Fehler zu produzieren.
- **PWA**: `manifest.json` + `sw.js` (Service Worker, u. a. für Push-Empfang/Klick-Handling) machen die App "Zum Homescreen hinzufügen"-fähig; `InstallBanner` reagiert auf das native `beforeinstallprompt`-Event.

## Sicherheitsmodell (Kurzfassung)

Details in [`DATABASE.md`](DATABASE.md#row-level-security-modell). Kernidee: alles, was ein Client direkt lesen/schreiben darf, wird über RLS-Policies erzwungen (nicht durch "der Client fragt halt nicht danach"); alles, was eine Sonderrolle braucht (fremde Spielerdaten schreiben, `game_stats` anlegen), läuft ausschließlich über die service-role-Edge-Function mit expliziter, im Code sichtbarer Berechtigungsprüfung.
