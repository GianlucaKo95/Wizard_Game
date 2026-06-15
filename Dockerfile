# ARG vor allen FROM-Anweisungen
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

RUN apk add --no-cache nginx bash

COPY --from=builder /build/dist /app/dist
COPY nginx.conf /etc/nginx/http.d/wizard.conf

# s6-overlay erwartet Services unter /etc/services.d/
COPY run.sh /etc/services.d/wizard/run
RUN chmod +x /etc/services.d/wizard/run
