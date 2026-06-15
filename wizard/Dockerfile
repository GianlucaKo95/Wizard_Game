FROM alpine:3.19

RUN apk add --no-cache nginx bash curl \
    && mkdir -p /var/log/nginx /var/lib/nginx/tmp /run/nginx \
    && chown -R root:root /var/log/nginx /var/lib/nginx /run/nginx

WORKDIR /app

COPY dist/ /app/frontend/dist/

RUN rm -f /etc/nginx/http.d/default.conf
COPY nginx.conf /etc/nginx/http.d/wizard.conf

COPY run.sh /run.sh
RUN chmod +x /run.sh

LABEL \
    io.hass.name="Wizard" \
    io.hass.description="Wizard Kartenspiel – Online Multiplayer" \
    io.hass.type="addon" \
    io.hass.version="2.0.3"

CMD ["/run.sh"]
