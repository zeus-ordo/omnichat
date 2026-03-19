#!/bin/bash
# Phase 2 Assistant Actions Test Helper
# Usage: source scripts/phase2-test-env.sh

set -euo pipefail

API_BASE="${API_BASE:-http://localhost/api}"
API_KEY="${API_KEY:-demo_api_key_12345}"

echo "=== Phase 2 Test Environment Setup ==="
echo "API Base: $API_BASE"

# Helper function to get token
get_token() {
    local email="$1"
    local password="$2"
    curl -sS -X POST "$API_BASE/auth/login" \
        -H "Content-Type: application/json" \
        -H "X-API-Key: $API_KEY" \
        -d "{\"email\":\"$email\",\"password\":\"$password\"}" | \
        grep -o '"access_token":"[^"]*"' | cut -d'"' -f4
}

get_token_with_api_key() {
    local api_key="$1"
    local email="$2"
    local password="$3"
    curl -sS -X POST "$API_BASE/auth/login" \
        -H "Content-Type: application/json" \
        -H "X-API-Key: $api_key" \
        -d "{\"email\":\"$email\",\"password\":\"$password\"}" | \
        grep -o '"access_token":"[^"]*"' | cut -d'"' -f4
}

# Helper function to check role permission
check_role_action() {
    local token="$1"
    local role="$2"
    local expected_status="$3"  # 200|201, 403, 401
    local description="$4"

    response=$(curl -sS -o /dev/null -w "%{http_code}" \
        -X POST "$API_BASE/ai/assistant/actions/plan" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d '{"message":"action tenant_bot_channel_toggle {\"botId\":\"test\",\"channelType\":\"line\",\"enabled\":false}"}')

    if [[ "$expected_status" == *"|"* ]]; then
        if [[ "|$expected_status|" == *"|$response|"* ]]; then
            echo "  [PASS] $role: $description (got $response)"
        else
            echo "  [FAIL] $role: $description (expected $expected_status, got $response)"
        fi
    elif [ "$response" == "$expected_status" ]; then
        echo "  [PASS] $role: $description (got $response)"
    else
        echo "  [FAIL] $role: $description (expected $expected_status, got $response)"
    fi
}

create_second_tenant() {
    local tenant_name="phase2-tenant-$(date +%s)"
    local tenant_response
    tenant_response=$(curl -sS -X POST "$API_BASE/tenants" \
        -H "Authorization: Bearer $OWNER_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"$tenant_name\",\"plan\":\"free\"}")

    if ! echo "$tenant_response" | grep -q '"id"'; then
        echo "  [WARN] Failed to create second tenant"
        echo "  [INFO] Response: $tenant_response"
        return
    fi

    SECOND_TENANT_ID=$(echo "$tenant_response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    SECOND_TENANT_SCHEMA=$(echo "$tenant_response" | grep -o '"schema_name":"[^"]*"' | cut -d'"' -f4)

    local api_key_response
    api_key_response=$(curl -sS -X POST "$API_BASE/tenants/$SECOND_TENANT_ID/api-keys" \
        -H "Authorization: Bearer $OWNER_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"name":"Phase2 Test Key"}')

    SECOND_TENANT_API_KEY=$(echo "$api_key_response" | grep -o '"api_key":"[^"]*"' | cut -d'"' -f4)

    echo "  [OK] Second tenant created: $SECOND_TENANT_ID"
    echo "  [OK] Second tenant schema: $SECOND_TENANT_SCHEMA"
    if [ -n "${SECOND_TENANT_API_KEY:-}" ]; then
        echo "  [OK] Second tenant API key issued"
    else
        echo "  [WARN] Could not issue second tenant API key"
    fi
}

create_second_tenant_owner() {
    if [ -z "${SECOND_TENANT_SCHEMA:-}" ] || [ -z "${SECOND_TENANT_API_KEY:-}" ]; then
        echo "  [WARN] Second tenant is not ready for owner seeding"
        return
    fi

    SECOND_TENANT_OWNER_EMAIL="owner_test_$(date +%s)@demo.com"
    SECOND_TENANT_OWNER_PASSWORD="owner123"

    local password_hash
    password_hash=$(docker exec omnibot-api node -e "const bcrypt=require('bcrypt'); bcrypt.hash(process.argv[1], 10).then(v=>console.log(v));" "$SECOND_TENANT_OWNER_PASSWORD")

    docker exec omnibot-db psql -U omnibot -d omnibot -c "INSERT INTO \"$SECOND_TENANT_SCHEMA\".users (email, password_hash, name, role) VALUES ('$SECOND_TENANT_OWNER_EMAIL', '$password_hash', 'Second Tenant Owner', 'owner');" >/dev/null

    SECOND_TENANT_OWNER_TOKEN=$(get_token_with_api_key "$SECOND_TENANT_API_KEY" "$SECOND_TENANT_OWNER_EMAIL" "$SECOND_TENANT_OWNER_PASSWORD")

    if [ -n "$SECOND_TENANT_OWNER_TOKEN" ]; then
        echo "  [OK] Second tenant owner token obtained"
    else
        echo "  [WARN] Failed to obtain second tenant owner token"
    fi
}

verify_cross_tenant_isolation() {
    if [ -z "${SECOND_TENANT_OWNER_TOKEN:-}" ]; then
        echo "  [WARN] Skipping cross-tenant checks because second tenant owner token is missing"
        return
    fi

    local owner_plan_response
    owner_plan_response=$(curl -sS -X POST "$API_BASE/ai/assistant/actions/plan" \
        -H "Authorization: Bearer $OWNER_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"message":"action tenant_bot_channel_toggle {\"botId\":\"bot-isolation\",\"channelType\":\"line\",\"enabled\":false}"}')

    DEMO_ACTION_ID=$(echo "$owner_plan_response" | grep -o '"actionId":"[^"]*"' | cut -d'"' -f4)
    DEMO_CONFIRM_TOKEN=$(echo "$owner_plan_response" | grep -o '"confirmationToken":"[^"]*"' | cut -d'"' -f4)

    if [ -z "${DEMO_ACTION_ID:-}" ]; then
        echo "  [WARN] Could not create demo pending action for isolation test"
        echo "  [INFO] Response: $owner_plan_response"
        return
    fi

    local cross_confirm_status
    cross_confirm_status=$(curl -sS -o /tmp/cross-tenant-confirm.out -w "%{http_code}" \
        -X POST "$API_BASE/ai/assistant/actions/confirm/$DEMO_ACTION_ID" \
        -H "Authorization: Bearer $SECOND_TENANT_OWNER_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"confirmationToken\":\"$DEMO_CONFIRM_TOKEN\"}")

    if [ "$cross_confirm_status" == "400" ] || [ "$cross_confirm_status" == "403" ] || [ "$cross_confirm_status" == "404" ]; then
        echo "  [PASS] second tenant cannot confirm demo tenant action (got $cross_confirm_status)"
    else
        echo "  [FAIL] second tenant confirm should fail (got $cross_confirm_status)"
        echo "  [INFO] Response: $(cat /tmp/cross-tenant-confirm.out)"
    fi

    local second_history
    second_history=$(curl -sS -X GET "$API_BASE/ai/assistant/actions/history" \
        -H "Authorization: Bearer $SECOND_TENANT_OWNER_TOKEN")

    if echo "$second_history" | grep -q "$DEMO_ACTION_ID"; then
        echo "  [FAIL] second tenant history leaked demo tenant action"
    else
        echo "  [PASS] second tenant history does not include demo tenant action"
    fi
}

echo ""
echo "=== Login as Owner ==="
OWNER_TOKEN=$(get_token "admin@demo.com" "admin123")
if [ -n "$OWNER_TOKEN" ]; then
    echo "  [OK] Owner token obtained"
else
    echo "  [ERROR] Failed to get owner token"
    exit 1
fi

echo ""
echo "=== Test: Owner should be able to plan tenant action ==="
check_role_action "$OWNER_TOKEN" "owner" "200|201" "owner can plan tenant action"

echo ""
echo "=== Create Agent User ==="
# Try to create an agent user
AGENT_EMAIL="agent_test_$(date +%s)@demo.com"
AGENT_PASSWORD="agent123"

AGENT_RESPONSE=$(curl -sS -X POST "$API_BASE/users" \
    -H "Authorization: Bearer $OWNER_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$AGENT_EMAIL\",\"password\":\"$AGENT_PASSWORD\",\"name\":\"Test Agent\",\"role\":\"agent\"}")

if echo "$AGENT_RESPONSE" | grep -q "id"; then
    echo "  [OK] Agent user created: $AGENT_EMAIL"
    sleep 1
    AGENT_TOKEN=$(get_token "$AGENT_EMAIL" "$AGENT_PASSWORD")
    if [ -n "$AGENT_TOKEN" ]; then
        echo "  [OK] Agent token obtained"
    fi
else
    # User might already exist, try to login
    echo "  [INFO] Trying to login as existing agent..."
    AGENT_EMAIL="agent@demo.com"
    AGENT_PASSWORD="agent123"
    AGENT_TOKEN=$(get_token "$AGENT_EMAIL" "$AGENT_PASSWORD")
    if [ -n "$AGENT_TOKEN" ]; then
        echo "  [OK] Existing agent token obtained"
    else
        echo "  [WARN] Could not create or find agent user, using admin token for all tests"
        AGENT_TOKEN="$OWNER_TOKEN"
    fi
fi

echo ""
echo "=== Test: Agent should be denied tenant action ==="
check_role_action "$AGENT_TOKEN" "agent" "403" "agent denied tenant action"

echo ""
echo "=== Test: Agent can still do read-only action ==="
response=$(curl -sS -o /dev/null -w "%{http_code}" \
    -X POST "$API_BASE/ai/assistant/actions/plan" \
    -H "Authorization: Bearer $AGENT_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"message":"show my profile"}')

if [ "$response" == "200" ] || [ "$response" == "201" ]; then
    echo "  [PASS] agent: can do read-only action (got $response)"
else
    echo "  [FAIL] agent: can do read-only action (expected 200/201, got $response)"
fi

echo ""
echo "=== Create Second Tenant for Isolation Tests ==="
create_second_tenant

echo ""
echo "=== Seed Second Tenant Owner ==="
create_second_tenant_owner

echo ""
echo "=== Verify Cross-Tenant Isolation ==="
verify_cross_tenant_isolation

echo ""
echo "=== Environment Variables Ready ==="
echo "export OWNER_TOKEN='$OWNER_TOKEN'"
echo "export AGENT_TOKEN='$AGENT_TOKEN'"
if [ -n "${SECOND_TENANT_ID:-}" ]; then
    echo "export SECOND_TENANT_ID='$SECOND_TENANT_ID'"
    echo "export SECOND_TENANT_SCHEMA='$SECOND_TENANT_SCHEMA'"
fi
if [ -n "${SECOND_TENANT_API_KEY:-}" ]; then
    echo "export SECOND_TENANT_API_KEY='$SECOND_TENANT_API_KEY'"
fi
if [ -n "${SECOND_TENANT_OWNER_TOKEN:-}" ]; then
    echo "export SECOND_TENANT_OWNER_TOKEN='$SECOND_TENANT_OWNER_TOKEN'"
fi
echo ""
echo "Use these tokens in subsequent tests:"
echo "  curl -H \"Authorization: Bearer \$OWNER_TOKEN\" ..."
