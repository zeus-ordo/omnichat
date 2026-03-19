import {
  AssistantActionDefinition,
  AssistantActionType,
  AssistantActionPhase,
  AssistantActionRiskLevel,
  AssistantActionScope,
  JsonValueType,
} from './assistant-actions.types';

type TenantSettingsShape = {
  assistant_actions?: {
    phase2_allowlist?: string[];
    allowlist?: string[];
  };
};

const emptyPayloadSchema = {
  required: [] as string[],
  properties: {} as Record<string, JsonValueType>,
};

const actionDefinitions: Record<AssistantActionType, AssistantActionDefinition> = {
  get_my_profile: {
    phase: 'phase1',
    scope: 'user',
    riskLevel: 'low',
    rolesAllowed: ['owner', 'admin', 'agent', 'viewer'],
    requiresConfirmation: false,
    payloadSchema: emptyPayloadSchema,
  },
  update_my_display_name: {
    phase: 'phase1',
    scope: 'user',
    riskLevel: 'medium',
    rolesAllowed: ['owner', 'admin', 'agent', 'viewer'],
    requiresConfirmation: true,
    payloadSchema: {
      required: ['displayName'],
      properties: {
        displayName: 'string',
      },
    },
  },
  update_my_language: {
    phase: 'phase1',
    scope: 'user',
    riskLevel: 'low',
    rolesAllowed: ['owner', 'admin', 'agent', 'viewer'],
    requiresConfirmation: true,
    payloadSchema: {
      required: ['language'],
      properties: {
        language: 'string',
      },
    },
  },
  update_my_notification_pref: {
    phase: 'phase1',
    scope: 'user',
    riskLevel: 'low',
    rolesAllowed: ['owner', 'admin', 'agent', 'viewer'],
    requiresConfirmation: true,
    payloadSchema: {
      required: ['notificationsEnabled'],
      properties: {
        notificationsEnabled: 'boolean',
      },
    },
  },
  tenant_bot_channel_toggle: {
    phase: 'phase2',
    scope: 'tenant',
    riskLevel: 'medium',
    rolesAllowed: ['owner', 'admin'],
    requiresConfirmation: true,
    payloadSchema: {
      required: ['botId', 'channelType', 'enabled'],
      properties: {
        botId: 'string',
        channelType: 'string',
        enabled: 'boolean',
      },
    },
  },
  tenant_bot_channel_config_update: {
    phase: 'phase2',
    scope: 'tenant',
    riskLevel: 'high',
    rolesAllowed: ['owner', 'admin'],
    requiresConfirmation: true,
    payloadSchema: {
      required: ['botId', 'channelType', 'config'],
      properties: {
        botId: 'string',
        channelType: 'string',
        config: 'object',
      },
    },
  },
  tenant_assistant_config_update: {
    phase: 'phase2',
    scope: 'tenant',
    riskLevel: 'high',
    rolesAllowed: ['owner', 'admin'],
    requiresConfirmation: true,
    payloadSchema: {
      required: ['assistantConfig'],
      properties: {
        assistantConfig: 'object',
      },
    },
  },
  tenant_kb_binding_update: {
    phase: 'phase2',
    scope: 'tenant',
    riskLevel: 'high',
    rolesAllowed: ['owner', 'admin'],
    requiresConfirmation: true,
    payloadSchema: {
      required: ['botId', 'knowledgeBaseIds'],
      properties: {
        botId: 'string',
        knowledgeBaseIds: 'array',
      },
    },
  },
};

export function getAssistantActionDefinition(actionType: AssistantActionType): AssistantActionDefinition {
  return actionDefinitions[actionType];
}

export function getActionMetadata(actionType: AssistantActionType): {
  phase: AssistantActionPhase;
  scope: AssistantActionScope;
  riskLevel: AssistantActionRiskLevel;
  requiresConfirmation: boolean;
} {
  const definition = getAssistantActionDefinition(actionType);
  return {
    phase: definition.phase,
    scope: definition.scope,
    riskLevel: definition.riskLevel,
    requiresConfirmation: definition.requiresConfirmation,
  };
}

export function isActionRoleAllowed(actionType: AssistantActionType, role?: string): boolean {
  const definition = getAssistantActionDefinition(actionType);
  const normalizedRole = role || 'viewer';
  return definition.rolesAllowed.includes(normalizedRole);
}

export function isTenantActionAllowlisted(
  actionType: AssistantActionType,
  tenantSettings: TenantSettingsShape | null | undefined,
): boolean {
  const definition = getAssistantActionDefinition(actionType);
  if (definition.phase !== 'phase2' || definition.scope !== 'tenant') {
    return true;
  }

  const allowlist =
    tenantSettings?.assistant_actions?.phase2_allowlist ||
    tenantSettings?.assistant_actions?.allowlist ||
    [];

  return Array.isArray(allowlist) && allowlist.includes(actionType);
}

export function validateActionPayload(
  actionType: AssistantActionType,
  payload: Record<string, unknown>,
): { ok: true } | { ok: false; reason: string } {
  const definition = getAssistantActionDefinition(actionType);
  const schema = definition.payloadSchema;

  for (const key of schema.required) {
    if (!(key in payload)) {
      return {
        ok: false,
        reason: `Missing required payload field: ${key}`,
      };
    }
  }

  for (const key of Object.keys(payload)) {
    if (!(key in schema.properties)) {
      return {
        ok: false,
        reason: `Unexpected payload field: ${key}`,
      };
    }

    const value = payload[key];
    const expectedType = schema.properties[key];
    const typeMatched =
      (expectedType === 'array' && Array.isArray(value)) ||
      (expectedType === 'object' && value !== null && typeof value === 'object' && !Array.isArray(value)) ||
      (expectedType === 'string' && typeof value === 'string') ||
      (expectedType === 'boolean' && typeof value === 'boolean') ||
      (expectedType === 'number' && typeof value === 'number' && Number.isFinite(value));

    if (!typeMatched) {
      const valueType = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
      return {
        ok: false,
        reason: `Invalid type for ${key}: expected ${expectedType}, got ${valueType}`,
      };
    }
  }

  return { ok: true };
}
