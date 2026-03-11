#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup-file.sql.gz|backup-file.sql>"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
INPUT_FILE="$1"

if [[ ! -f "${INPUT_FILE}" ]]; then
  echo "[restore] file not found: ${INPUT_FILE}"
  exit 1
fi

echo "[restore] restoring from ${INPUT_FILE}"

if [[ "${INPUT_FILE}" == *.gz ]]; then
  gunzip -c "${INPUT_FILE}" | docker-compose -f "${ROOT_DIR}/docker-compose.yml" exec -T postgres psql -U omnibot -d omnibot
else
  cat "${INPUT_FILE}" | docker-compose -f "${ROOT_DIR}/docker-compose.yml" exec -T postgres psql -U omnibot -d omnibot
fi

echo "[restore] done"
