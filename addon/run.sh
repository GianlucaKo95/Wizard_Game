#!/usr/bin/with-contenv bashio

SUPA_URL=$(bashio::config 'supabase_url')
SUPA_KEY=$(bashio::config 'supabase_anon_key')

bashio::log.info "Injecting Supabase config..."
find /app/dist -name "*.js" \
  -exec sed -i "s|__SUPABASE_URL__|${SUPA_URL}|g" {} \; \
  -exec sed -i "s|__SUPABASE_ANON_KEY__|${SUPA_KEY}|g" {} \;

bashio::log.info "Starting nginx..."
exec nginx -g "daemon off;"
