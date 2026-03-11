#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${ROOT_DIR}/backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/omnibot_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[backup] creating ${BACKUP_FILE}"
docker-compose -f "${ROOT_DIR}/docker-compose.yml" exec -T postgres \
  pg_dump -U omnibot -d omnibot | gzip > "${BACKUP_FILE}"

echo "[backup] done"
