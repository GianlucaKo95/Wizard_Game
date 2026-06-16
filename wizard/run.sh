#!/usr/bin/env bash
set -euo pipefail

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
log "Wizard v2.0.7 startet..."

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

log "nginx config test..."
nginx -t 2>&1 || { log "nginx config FEHLER!"; exit 1; }

log "Starte nginx auf Port 3043..."
nginx -g "daemon off;" &
NGINX_PID=$!

sleep 2
if ! kill -0 $NGINX_PID 2>/dev/null; then
    log "FEHLER: nginx ist sofort abgestürzt!"
    exit 1
fi

log "nginx PID: $NGINX_PID – läuft!"

wait $NGINX_PID
log "nginx beendet mit Code $?"
