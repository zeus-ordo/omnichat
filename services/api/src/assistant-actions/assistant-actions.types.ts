export type AssistantActionType =
  | 'get_my_profile'
  | 'update_my_display_name'
  | 'update_my_language'
  | 'update_my_notification_pref'
  | 'tenant_bot_channel_toggle'
  | 'tenant_bot_channel_config_update'
  | 'tenant_assistant_config_update'
  | 'tenant_kb_binding_update';

export type AssistantActionPhase = 'phase1' | 'phase2';

export type AssistantActionRiskLevel = 'low' | 'medium' | 'high';

export type AssistantActionScope = 'user' | 'tenant';

export type JsonValueType = 'string' | 'boolean' | 'number' | 'object' | 'array';

export interface AssistantActionSchema {
  required: string[];
  properties: Record<string, JsonValueType>;
}

export interface AssistantActionDefinition {
  phase: AssistantActionPhase;
  scope: AssistantActionScope;
  riskLevel: AssistantActionRiskLevel;
  rolesAllowed: readonly string[];
  requiresConfirmation: boolean;
  payloadSchema: AssistantActionSchema;
}

export interface AssistantApprovalDecision {
  approved: boolean;
  reason?: string;
}

export interface AssistantApprovalHook {
  evaluate(input: {
    tenantSchema: string;
    user: AuthUser;
    actionType: AssistantActionType;
    payload: Record<string, unknown>;
    riskLevel: AssistantActionRiskLevel;
  }): Promise<AssistantApprovalDecision>;
}

export interface AuthUser {
  sub: string;
  email?: string;
  role?: string;
  tenant_schema?: string;
  tenant_id?: string;
}

export interface ActionPlanResult {
  actionType: AssistantActionType;
  payload: Record<string, unknown>;
  preview: string;
  requiresConfirmation: boolean;
}

export interface PendingActionRow {
  id: string;
  tenant_schema: string;
  user_id: string;
  action_type: AssistantActionType;
  payload: Record<string, unknown>;
  phase?: AssistantActionPhase;
  scope?: AssistantActionScope;
  risk_level?: AssistantActionRiskLevel;
  status: 'pending' | 'processing' | 'confirmed' | 'expired' | 'cancelled' | 'failed';
  confirmation_token_hash?: string | null;
  token_expires_at?: string | null;
  confirmation_attempts?: number;
  created_at: string;
  expires_at: string;
}

export type AssistantAuditStatus =
  | 'planned'
  | 'confirmed'
  | 'failed'
  | 'executed'
  | 'denied'
  | 'expired'
  | 'rejected';

export type AssistantAuditClassification =
  | 'success'
  | 'authorization'
  | 'validation'
  | 'security'
  | 'system';
