ARG BUILD_FROM
FROM ${BUILD_FROM}

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Install dependencies
RUN apk add --no-cache nginx bash curl nodejs npm

WORKDIR /app

# Build frontend
COPY frontend/ ./frontend-src/
RUN cd frontend-src \
    && npm install --no-audit --no-fund \
    && VITE_SUPABASE_URL=__SUPABASE_URL__ VITE_SUPABASE_ANON_KEY=__SUPABASE_ANON_KEY__ npm run build \
    && mkdir -p /app/frontend \
    && mv /app/frontend-src/dist /app/frontend/dist \
    && cd / && rm -rf /app/frontend-src

COPY nginx.conf /etc/nginx/http.d/default.conf
COPY run.sh /run.sh
RUN chmod +x /run.sh

LABEL \
    io.hass.name="Wizard" \
    io.hass.description="Wizard Kartenspiel – Online Multiplayer" \
    io.hass.type="addon" \
    io.hass.version="2.0.0"

CMD ["/run.sh"]
