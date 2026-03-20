# Phase 2 QA and Rollout Plan

## Scope

Phase 2 validates and rolls out tenant-level assistant actions with elevated risk controls (role restriction, mandatory confirmation for mutating operations, strict payload schema, and auditability).

## Preconditions

- Docker services are running (`postgres`, `redis`, `rabbitmq`) and API is reachable.
- Tester has at least two tenants and test users for roles: `owner`, `admin`, `agent`.
- Test environment has valid credentials and API key.

```bash
# from repo root
docker-compose up -d postgres redis rabbitmq

# API shell setup
export API_BASE_URL="http://localhost/api"
export API_KEY="<tenant-api-key>"
export OWNER_EMAIL="owner@demo.com"
export OWNER_PASSWORD="<password>"
```

## Verification Setup Commands

```bash
# 1) build API
npm --prefix services/api run build

# 2) build admin dashboard
npm --prefix services/admin-dashboard run build

# 3) build chat widget
npm --prefix services/chat-widget run build
```

## Test Matrix

| ID | Area | Actor Role | Tenant Context | Risk | Expected Result | Verification Command |
| --- | --- | --- | --- | --- | --- | --- |
| TM-01 | Read-only assistant action | agent | own tenant | low | Request succeeds without confirmation and writes audit entry | `curl -fsS -X POST "$API_BASE_URL/ai/assistant/actions/plan" -H "X-API-Key: $API_KEY" -H "Authorization: Bearer $AGENT_TOKEN" -H "Content-Type: application/json" -d '{"message":"show my profile"}'` |
| TM-02 | Tenant-level mutating action | admin | own tenant | high | Plan succeeds but requires confirmation before apply | `curl -fsS -X POST "$API_BASE_URL/ai/assistant/actions/plan" -H "X-API-Key: $API_KEY" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"message":"disable bot channel"}'` |
| TM-03 | Tenant-level mutating action | agent | own tenant | high | Authorization denied (403/401), no mutation, audit denied event present | `curl -i -X POST "$API_BASE_URL/ai/assistant/actions/plan" -H "X-API-Key: $API_KEY" -H "Authorization: Bearer $AGENT_TOKEN" -H "Content-Type: application/json" -d '{"message":"disable bot channel"}'` |
| TM-04 | Cross-tenant isolation | owner | different tenant payload | critical | Request denied; no cross-tenant state change | `curl -i -X POST "$API_BASE_URL/ai/assistant/actions/plan" -H "X-API-Key: $API_KEY" -H "Authorization: Bearer $OWNER_TOKEN" -H "Content-Type: application/json" -d '{"message":"bind KB to tenant beta"}'` |
| TM-05 | Confirmation flow | admin | own tenant | high | Pending action created, confirm endpoint applies once, duplicate confirm rejected | `curl -fsS -X POST "$API_BASE_URL/ai/assistant/actions/confirm/$ACTION_ID" -H "X-API-Key: $API_KEY" -H "Authorization: Bearer $ADMIN_TOKEN"` |
| TM-06 | Payload schema enforcement | owner | own tenant | high | Invalid payload rejected with 400; no state change | `curl -i -X POST "$API_BASE_URL/ai/assistant/actions/plan" -H "X-API-Key: $API_KEY" -H "Authorization: Bearer $OWNER_TOKEN" -H "Content-Type: application/json" -d '{"message":"set bot channel","params":{"unexpected":true}}'` |
| TM-07 | Audit completeness | owner | own tenant | medium | Plan/confirm/failure entries contain actor, tenant, action, status, timestamp | `curl -fsS "$API_BASE_URL/ai/assistant/actions/history" -H "X-API-Key: $API_KEY" -H "Authorization: Bearer $OWNER_TOKEN"` |
| TM-08 | Idempotency and retries | admin | own tenant | medium | Retry does not duplicate applied mutation | `for i in 1 2; do curl -s -o /dev/null -w "%{http_code}\n" -X POST "$API_BASE_URL/ai/assistant/actions/confirm/$ACTION_ID" -H "X-API-Key: $API_KEY" -H "Authorization: Bearer $ADMIN_TOKEN"; done` |

## End-to-End Scenarios

### E2E-01: Owner updates tenant assistant config (happy path)

```bash
# login owner and capture token
OWNER_TOKEN=$(curl -fsS -X POST "$API_BASE_URL/auth/login" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"'"$OWNER_EMAIL"'","password":"'"$OWNER_PASSWORD"'"}' | jq -r '.access_token')

# plan action
PLAN_RESP=$(curl -fsS -X POST "$API_BASE_URL/ai/assistant/actions/plan" \
  -H "X-API-Key: $API_KEY" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"set assistant tone to concise"}')

ACTION_ID=$(printf '%s' "$PLAN_RESP" | jq -r '.actionId')

# confirm action
curl -fsS -X POST "$API_BASE_URL/ai/assistant/actions/confirm/$ACTION_ID" \
  -H "X-API-Key: $API_KEY" \
  -H "Authorization: Bearer $OWNER_TOKEN"

# verify action is present in history
curl -fsS "$API_BASE_URL/ai/assistant/actions/history" \
  -H "X-API-Key: $API_KEY" \
  -H "Authorization: Bearer $OWNER_TOKEN" | jq '.items[0]'
```

Exit criteria:
- Plan returns pending/confirm-required state.
- Confirm succeeds exactly once.
- History contains matching `actionId`, actor, tenant, and success status.

### E2E-02: Agent blocked from tenant-level action

```bash
curl -i -X POST "$API_BASE_URL/ai/assistant/actions/plan" \
  -H "X-API-Key: $API_KEY" \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"disable website bot channel"}'
```

Exit criteria:
- Request returns authorization failure.
- No mutation observed in admin UI/API.
- Denied attempt recorded in action history/audit feed.

### E2E-03: Multi-tenant isolation under concurrent requests

```bash
for t in "$TENANT_A_OWNER_TOKEN" "$TENANT_B_OWNER_TOKEN"; do
  curl -fsS -X POST "$API_BASE_URL/ai/assistant/actions/plan" \
    -H "X-API-Key: $API_KEY" \
    -H "Authorization: Bearer $t" \
    -H "Content-Type: application/json" \
    -d '{"message":"link KB default to support"}' &
done
wait
```

Exit criteria:
- Each tenant sees only its own action entries.
- No cross-tenant updates or leaked identifiers.

## Rollout Steps

1. Verify build and smoke checks in staging.
2. Run full Phase 2 matrix in staging and record pass/fail.
3. Deploy to canary tenant cohort (1-5% of traffic/tenants).
4. Monitor error rate, authorization-denied spikes, and audit event throughput.
5. Expand to 25%, 50%, then 100% if gates remain green.

```bash
# example API deployment command (adapt to your pipeline)
docker-compose up -d --build api

# immediate smoke checks
curl -fsS "$API_BASE_URL/health"
curl -fsS "$API_BASE_URL/ai/assistant/actions/history" -H "X-API-Key: $API_KEY" -H "Authorization: Bearer $OWNER_TOKEN" >/dev/null
```

## Rollback Checklist

- Trigger rollback if any acceptance gate is red for 10 minutes or longer.
- Freeze new Phase 2 action confirmations.
- Revert API deployment to last known good image.
- Validate tenant settings integrity and audit continuity.
- Communicate incident status and mitigation timeline.

```bash
# rollback to previous stable image tag
export API_IMAGE_TAG="<last-known-good-tag>"
docker-compose up -d api

# post-rollback verification
curl -fsS "$API_BASE_URL/health"
npm --prefix services/api run build
```

## Acceptance Gates

All gates must pass before increasing rollout percentage.

1. Functional gate: 100% pass on TM-01..TM-08.
2. Security gate: no cross-tenant data exposure and no unauthorized mutating success.
3. Reliability gate: no duplicate apply on confirm retries.
4. Audit gate: 100% of tested actions produce complete audit fields.
5. Operational gate: API build succeeds and health checks stay green.

```bash
# quick gate script skeleton from repo root
set -euo pipefail

npm --prefix services/api run build
curl -fsS "$API_BASE_URL/health" >/dev/null

echo "Run TM-01..TM-08 and record results in QA tracker"
echo "Promote rollout only if all acceptance gates are green"
```

## Artifacts to Attach to Release Ticket

- Completed TM-01..TM-08 evidence (request/response snippets, timestamps).
- Canary monitoring snapshots (error rate, denied actions, latency).
- Audit log extracts for representative success/failure cases.
- Rollback drill output from latest rehearsal.
