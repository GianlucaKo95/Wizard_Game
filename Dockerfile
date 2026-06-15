ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:latest

# ── Stage 1: Build React client ───────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /build
COPY client/package*.json ./
RUN npm install
COPY client/ ./
ENV VITE_SUPABASE_URL=__SUPABASE_URL__
ENV VITE_SUPABASE_ANON_KEY=__SUPABASE_ANON_KEY__
RUN npm run build

# ── Stage 2: HA base image ────────────────────────────────────────────────────
ARG BUILD_FROM
FROM ${BUILD_FROM}
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN apk add --no-cache nginx bash curl

COPY --from=builder /build/dist /app/dist
COPY nginx.conf /etc/nginx/http.d/default.conf
COPY run.sh /run.sh
RUN chmod +x /run.sh

LABEL \
    io.hass.name="Wizard" \
    io.hass.description="Wizard Kartenspiel – Online Multiplayer" \
    io.hass.type="addon" \
    io.hass.version="2.0.0"

CMD ["/run.sh"]
