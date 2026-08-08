#!/bin/sh
set -e

OPTIONS=/data/options.json
SECRET=$(jq -r '.shared_secret // empty' "$OPTIONS")
MIN_PORT=$(jq -r '.relay_min_port // 49160' "$OPTIONS")
MAX_PORT=$(jq -r '.relay_max_port // 49300' "$OPTIONS")

if [ -z "$SECRET" ]; then
  echo "shared_secret ist nicht gesetzt - bitte in den Add-on-Einstellungen einen Wert eintragen (muss mit dem TURN_SHARED_SECRET-Secret der Supabase Edge Function übereinstimmen)." >&2
  exit 1
fi

exec turnserver \
  --no-cli \
  --listening-port=3478 \
  --min-port="$MIN_PORT" \
  --max-port="$MAX_PORT" \
  --use-auth-secret \
  --static-auth-secret="$SECRET" \
  --realm=wizzo.local \
  --no-tls \
  --no-dtls \
  --fingerprint \
  --log-file=stdout \
  --simple-log
