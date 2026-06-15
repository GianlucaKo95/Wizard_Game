ARG BUILD_FROM
FROM ${BUILD_FROM}

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN apk add --no-cache nginx bash curl

WORKDIR /app

# Nur das fertige dist/ wird hineinkopiert (gebaut im Workflow)
COPY dist/ /app/frontend/dist/

COPY nginx.conf /etc/nginx/http.d/default.conf

# s6-overlay service
COPY rootfs/ /

LABEL \
    io.hass.name="Wizard" \
    io.hass.description="Wizard Kartenspiel – Online Multiplayer" \
    io.hass.type="addon" \
    io.hass.version="2.0.1"
