#!/usr/bin/env bash
set -euo pipefail

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
log "Wizard v2.0.0 startet..."

# Supabase Config aus HA Options lesen
SUPA_URL=$(bashio::config 'supabase_url' 2>/dev/null || echo "${SUPABASE_URL:-}")
SUPA_KEY=$(bashio::config 'supabase_anon_key' 2>/dev/null || echo "${SUPABASE_ANON_KEY:-}")

if [ -z "${SUPA_URL}" ] || [ -z "${SUPA_KEY}" ]; then
    log "FEHLER: supabase_url und supabase_anon_key müssen konfiguriert sein!"
    exit 1
fi

log "Injecting Supabase config..."
find /app/dist -name "*.js" \
    -exec sed -i "s|__SUPABASE_URL__|${SUPA_URL}|g" {} \; \
    -exec sed -i "s|__SUPABASE_ANON_KEY__|${SUPA_KEY}|g" {} \;

log "Starte nginx..."
nginx &
NGINX_PID=$!

cleanup() {
    log "Beende Wizard..."
    kill "${NGINX_PID}" 2>/dev/null || true
    wait
}
trap cleanup SIGTERM SIGINT

log "Wizard läuft auf Port 3043"
wait "${NGINX_PID}"
