#!/usr/bin/with-contenv bashio
set -euo pipefail

DATA_DIR="${DINNERHUB_DATA_DIR:-/data/dinnerhub}"
mkdir -p "${DATA_DIR}" "${DATA_DIR}/backups" "${DATA_DIR}/uploads"

bashio::log.info "Starting DinnerHub ${DINNERHUB_VERSION:-development}"
bashio::log.info "Persistent data directory: ${DATA_DIR}"

exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8099 \
  --proxy-headers \
  --forwarded-allow-ips="172.30.32.2,127.0.0.1"
