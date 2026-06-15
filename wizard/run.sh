#!/usr/bin/env bash
set -euo pipefail

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
log "Wizard v2.0.0 startet..."

# Supabase config aus Umgebungsvariablen (via environment block in config.json)
SUPA_URL="${SUPABASE_URL:-}"
SUPA_KEY="${SUPABASE_ANON_KEY:-}"

if [ -z "${SUPA_URL}" ] || [ -z "${SUPA_KEY}" ]; then
    log "FEHLER: SUPABASE_URL und SUPABASE_ANON_KEY müssen konfiguriert sein!"
    exit 1
fi

log "Injecting Supabase config..."
find /app/frontend/dist -name "*.js" \
    -exec sed -i "s|__SUPABASE_URL__|${SUPA_URL}|g" {} \; \
    -exec sed -i "s|__SUPABASE_ANON_KEY__|${SUPA_KEY}|g" {} \;

log "Starte nginx auf Port 3043..."
nginx &
NGINX_PID=$!

cleanup() {
    log "Beende Wizard..."
    kill "${NGINX_PID}" 2>/dev/null || true
    wait
}
trap cleanup SIGTERM SIGINT

log "Wizard läuft"
wait "${NGINX_PID}"
