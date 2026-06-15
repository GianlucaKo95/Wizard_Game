# 🧙 Wizard – Home Assistant Add-on

Online Multiplayer Kartenspiel mit Supabase Backend.

## Repo-Struktur

```
wizard/                          ← Repo Root = Docker Build-Kontext
├── .github/workflows/
│   └── build-push.yml          ← baut amd64 + aarch64, pusht nach ghcr.io
├── client/                     ← React/Vite Frontend
├── supabase/
│   ├── migrations/             ← SQL Schema ausführen in Supabase
│   └── functions/game-action/  ← Edge Function deployen
├── Dockerfile                  ← Multi-Stage: node builder + HA base
├── config.yaml                 ← HA Add-on Konfiguration
├── repository.yaml             ← HA Add-on Repository
├── run.sh                      ← Injiziert Supabase-Config zur Laufzeit
└── nginx.conf                  ← Serv client auf Port 3043
```

## Setup

### 1. GitHub Repo erstellen & pushen

```bash
git init
git remote add origin https://github.com/DEIN_USERNAME/wizard.git
git add .
git commit -m "Initial commit"
git push -u origin main
```

→ GitHub Actions baut automatisch `ghcr.io/DEIN_USERNAME/wizard-amd64:latest`
  und `ghcr.io/DEIN_USERNAME/wizard-aarch64:latest`

**Wichtig:** In `config.yaml` und `repository.yaml` vorher `DEIN_USERNAME` ersetzen!

### 2. Supabase einrichten

- Neues Projekt auf supabase.com
- SQL Editor → Inhalt von `supabase/migrations/001_initial.sql` ausführen
- Edge Function deployen:
  ```bash
  npx supabase functions deploy game-action --project-ref DEIN-REF
  ```

### 3. HA Add-on installieren

- Einstellungen → Add-ons → Store → ⋮ → Repositories
- URL: `https://github.com/DEIN_USERNAME/wizard`
- Wizard erscheint → Installieren
- Konfiguration:
  ```yaml
  supabase_url: https://DEIN-REF.supabase.co
  supabase_anon_key: dein-anon-key
  ```
- Starten

### 4. Nginx Proxy Manager

| Feld | Wert |
|------|------|
| Domain | `wizard.heimdns.de` |
| Forward Port | `3043` |
| Websockets | ✅ |
| SSL | Let's Encrypt |
