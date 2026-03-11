#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${ROOT_DIR}/backups"
RETENTION_DAYS="${1:-14}"

mkdir -p "${BACKUP_DIR}"

echo "[backup-rotation] keeping ${RETENTION_DAYS} days"
find "${BACKUP_DIR}" -type f -name "omnibot_*.sql.gz" -mtime +"${RETENTION_DAYS}" -print -delete

echo "[backup-rotation] done"
