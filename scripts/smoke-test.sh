#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://omnichat.ordoai.co}"
EMAIL="${2:-superadmin@omnichat.ordoai.co}"
PASSWORD="${3:-OmniAdmin@2026!}"

echo "[smoke] BASE_URL=${BASE_URL}"

echo "[smoke] health"
curl -fsS -I "${BASE_URL}/health" >/dev/null

echo "[smoke] homepage"
curl -fsS -I "${BASE_URL}/" >/dev/null

echo "[smoke] login"
TOKEN=$(curl -fsS -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

if [[ -z "${TOKEN}" ]]; then
  echo "[smoke] login token missing"
  exit 1
fi

echo "[smoke] bots endpoint"
curl -fsS "${BASE_URL}/api/bots" -H "Authorization: Bearer ${TOKEN}" >/dev/null

echo "[smoke] assistant endpoint"
curl -fsS -X POST "${BASE_URL}/api/ai/assistant/chat" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"message":"smoke test"}' >/dev/null

echo "[smoke] OK"
