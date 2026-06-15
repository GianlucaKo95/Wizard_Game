# 🧙 Wizard – Supabase Multiplayer

## Architektur

```
Browser (React)
    │
    ▼
Supabase
    ├── Auth          → Login / Registrierung
    ├── Database      → Räume, Spieler, Statistiken
    ├── Realtime      → Live-Updates
    └── Edge Function → Spiellogik (cheat-sicher)
```

## Setup

### 1. Supabase Projekt erstellen

- Neues Projekt auf supabase.com anlegen
- Migration ausführen: Inhalt von `supabase/migrations/001_initial.sql` im SQL-Editor ausführen
- Edge Function deployen:
  ```bash
  npx supabase functions deploy game-action --project-ref DEIN-REF
  ```

### 2. GitHub Secrets setzen

| Secret | Wert |
|--------|------|
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Anon Key aus Supabase Settings |

### 3. HA Add-on installieren

- Add-on Store → Repositories → `https://github.com/DEIN_USERNAME/wizard`
- Wizard installieren
- Konfiguration:
  ```yaml
  supabase_url: https://xxx.supabase.co
  supabase_anon_key: dein-anon-key
  ```
- Starten → `http://wizard.heimdns.de`

### 4. NPM Proxy Host

Domain: `wizard.heimdns.de` → `localhost:3043`
Websockets Support: ✅ (für Supabase Realtime)

## Statistiken

Jeder eingeloggte Spieler sieht seine persönlichen Stats:
- Gespielte Spiele / Siege
- Durchschnittliche Punktzahl & Platzierung
- Trefferquote (gebotene vs. gemachte Stiche)
