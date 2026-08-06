FROM alpine:3.19
RUN apk add --no-cache coturn jq
COPY run.sh /run.sh
RUN chmod +x /run.sh
CMD ["/run.sh"]
