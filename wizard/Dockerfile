FROM alpine:3.19

RUN apk add --no-cache nginx bash curl

WORKDIR /app

COPY dist/ /app/frontend/dist/

# Remove default nginx config and add ours
RUN rm -f /etc/nginx/http.d/default.conf
COPY nginx.conf /etc/nginx/http.d/wizard.conf

COPY run.sh /run.sh
RUN chmod +x /run.sh

LABEL \
    io.hass.name="Wizard" \
    io.hass.description="Wizard Kartenspiel – Online Multiplayer" \
    io.hass.type="addon" \
    io.hass.version="2.0.1"

CMD ["/run.sh"]
