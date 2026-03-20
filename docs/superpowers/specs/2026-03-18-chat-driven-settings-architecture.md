# Chat-Driven Settings Control Architecture

## Goal

Enable each authenticated account to use chatbot conversations to safely view/update own account settings and (with role constraints) tenant backend settings.

## Core Flow

1. User sends chat request.
2. Intent parser maps message to allowlisted action.
3. Policy layer validates role + tenant context.
4. Executor runs bounded server-side action (never arbitrary SQL/code from model output).
5. Audit log records action details and outcome.

## Phase Plan

### Phase 1 (implemented foundation)

- Scope: low-risk per-account actions.
- Endpoints:
  - `POST /api/ai/assistant/actions/plan`
  - `POST /api/ai/assistant/actions/confirm/:actionId`
  - `GET /api/ai/assistant/actions/history`
- Allowlisted actions:
  - `get_my_profile`
  - `update_my_display_name`
  - `update_my_language`
  - `update_my_notification_pref`
- Storage:
  - `assistant_action_pending` (confirmation queue)
  - `assistant_action_audit_logs` (immutable action trail)

### Phase 2 (next)

- Scope: tenant-level setting actions with stronger controls.
- Add owner/admin-only actions:
  - bot channel toggles/config changes
  - assistant config update
  - KB binding
- Controls:
  - mandatory confirmation for all mutating operations
  - stricter payload schema per action
  - high-risk action tagging for approval hooks

### Phase 3 (next)

- Scope: governance and operability.
- Add:
  - approval workflow
  - rollback from audit snapshots
  - async execution for heavy/batch updates
  - metrics dashboards and alerting

## Security Principles

- Deny-by-default action policy.
- Role-based authorization enforced server-side.
- Tenant isolation from middleware + request context.
- No direct model-to-database write path.
- Full traceability for every planned/confirmed/failed action.

## Agent Assignment Model

- Agent A (Architecture/API): action contracts and endpoint versioning.
- Agent B (Backend Core): parser/policy/executor and pending/audit persistence.
- Agent C (Security): role matrix, confirmation safeguards, secret handling.
- Agent D (Frontend UX): chat confirmation UX and history views.
- Agent E (QA): role/tenant/e2e and failure-mode test suites.
