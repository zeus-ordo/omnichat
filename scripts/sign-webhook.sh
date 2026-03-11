#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 4 ]]; then
  echo "Usage: $0 <hmac-secret> <bot-id> <external-user-id> <message>"
  exit 1
fi

SECRET="$1"
BOT_ID="$2"
USER_ID="$3"
MESSAGE="$4"
TIMESTAMP="$(date +%s)"
PAYLOAD="${TIMESTAMP}.${BOT_ID}.${USER_ID}.${MESSAGE}"

SIGNATURE=$(printf "%s" "${PAYLOAD}" | openssl dgst -sha256 -hmac "${SECRET}" | awk '{print $2}')

echo "x-timestamp: ${TIMESTAMP}"
echo "x-signature: ${SIGNATURE}"
