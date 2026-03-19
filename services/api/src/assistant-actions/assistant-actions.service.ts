import { createHash, randomBytes } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  ActionPlanResult,
  AssistantActionDefinition,
  AssistantActionType,
  AssistantAuditClassification,
  AssistantAuditStatus,
  AuthUser,
  JsonValueType,
  PendingActionRow,
} from './assistant-actions.types';

type PlanContext = {
  tenantSchema: string;
  user: AuthUser;
};

type ConfirmContext = PlanContext & {
  confirmationToken?: string;
};

type AssistantChannelType = 'line' | 'facebook' | 'whatsapp';

type ActionSecurityError = {
  status: AssistantAuditStatus;
  classification: AssistantAuditClassification;
  errorCode: string;
  errorMessage: string;
};

const CONFIRMATION_WINDOW_SECONDS = 5 * 60;
const CONFIRMATION_TOKEN_LENGTH = 8;
const CONFIRMATION_TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SENSITIVE_FIELD_PATTERN =
  /(token|secret|password|key|private|credential|webhook|signature)/i;
const PHASE2_ALLOWED_CHANNELS: readonly AssistantChannelType[] = ['line', 'facebook', 'whatsapp'];

const ACTION_POLICY_TABLE: Record<AssistantActionType, AssistantActionDefinition> = {
  get_my_profile: {
    phase: 'phase1',
    scope: 'user',
    riskLevel: 'low',
    rolesAllowed: ['owner', 'admin', 'agent', 'viewer'],
    requiresConfirmation: false,
    payloadSchema: {
      required: [],
      properties: {},
    },
  },
  update_my_display_name: {
    phase: 'phase1',
    scope: 'user',
    riskLevel: 'low',
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

@Injectable()
export class AssistantActionsService {
  constructor(private readonly dataSource: DataSource) {}

  private isValidSchemaName(schemaName: string): boolean {
    return /^[a-z][a-z0-9_]*$/.test(schemaName) && schemaName.length <= 64;
  }

  private assertTenantSchema(tenantSchema: string): void {
    if (!this.isValidSchemaName(tenantSchema)) {
      throw new BadRequestException('Invalid tenant schema');
    }
  }

  private assertUser(user: AuthUser): void {
    if (!user || !user.sub) {
      throw new BadRequestException('Invalid user context');
    }
  }

  private throwBadRequest(code: string, message: string): never {
    throw new BadRequestException({
      code,
      message,
    });
  }

  private throwForbidden(code: string, message: string): never {
    throw new ForbiddenException({
      code,
      message,
    });
  }

  private getPolicy(actionType: AssistantActionType): AssistantActionDefinition {
    const policy = ACTION_POLICY_TABLE[actionType];
    if (!policy) {
      this.throwForbidden('ACTION_DENY_BY_DEFAULT', `Action "${actionType}" is not allowlisted`);
    }

    return policy;
  }

  private isAssistantActionType(value: string): value is AssistantActionType {
    return Object.prototype.hasOwnProperty.call(ACTION_POLICY_TABLE, value);
  }

  private normalizeRole(user: AuthUser): string {
    return String(user.role || 'viewer').toLowerCase();
  }

  private assertAllowed(actionType: AssistantActionType, user: AuthUser): AssistantActionDefinition {
    const policy = this.getPolicy(actionType);
    const role = this.normalizeRole(user);

    if (!policy.rolesAllowed.includes(role)) {
      this.throwForbidden(
        'ACTION_ROLE_DENIED',
        `Action "${actionType}" is not allowed for role "${role}"`,
      );
    }

    return policy;
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private hasOwn(obj: Record<string, unknown>, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  private matchesJsonValueType(value: unknown, expectedType: JsonValueType): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'boolean':
        return typeof value === 'boolean';
      case 'number':
        return typeof value === 'number' && Number.isFinite(value);
      case 'object':
        return this.isPlainObject(value);
      case 'array':
        return Array.isArray(value);
      default:
        return false;
    }
  }

  private assertPayloadSchema(actionType: AssistantActionType, payload: Record<string, unknown>): void {
    const policy = this.getPolicy(actionType);
    const schema = policy.payloadSchema;

    for (const requiredKey of schema.required) {
      if (!this.hasOwn(payload, requiredKey)) {
        this.throwBadRequest(
          'PAYLOAD_SCHEMA_REQUIRED_FIELD_MISSING',
          `Payload field "${requiredKey}" is required for action "${actionType}"`,
        );
      }
    }

    for (const [key, value] of Object.entries(payload)) {
      const expectedType = schema.properties[key];
      if (!expectedType) {
        this.throwBadRequest(
          'PAYLOAD_SCHEMA_FIELD_NOT_ALLOWED',
          `Payload field "${key}" is not allowed for action "${actionType}"`,
        );
      }

      if (!this.matchesJsonValueType(value, expectedType)) {
        this.throwBadRequest(
          'PAYLOAD_SCHEMA_TYPE_MISMATCH',
          `Payload field "${key}" expects type "${expectedType}"`,
        );
      }
    }
  }

  private parseChannelType(raw: string): AssistantChannelType | null {
    const value = raw.toLowerCase();
    if (/line|賴/.test(value)) {
      return 'line';
    }

    if (/facebook|fb|臉書|臉書粉專/.test(value)) {
      return 'facebook';
    }

    if (/whatsapp|wa/.test(value)) {
      return 'whatsapp';
    }

    return null;
  }

  private parseBotId(raw: string): string | null {
    const match = raw.match(/(?:bot|機器人)\s*(?:id)?\s*[:：=]\s*([A-Za-z0-9_-]{2,64})/i);
    return match ? match[1] : null;
  }

  private parseBooleanToggle(raw: string): boolean | null {
    if (/(開啟|啟用|enable|turn on|\bon\b|true)/i.test(raw)) {
      return true;
    }

    if (/(關閉|停用|disable|turn off|\boff\b|false)/i.test(raw)) {
      return false;
    }

    return null;
  }

  private parseStructuredActionCommand(normalized: string): ActionPlanResult | null {
    const structuredMatch = normalized.match(/^(?:action|動作)\s+([a-z_]+)\s+([\s\S]+)$/i);
    if (!structuredMatch) {
      return null;
    }

    const actionTypeRaw = structuredMatch[1].trim();
    if (!this.isAssistantActionType(actionTypeRaw)) {
      this.throwBadRequest('ACTION_UNKNOWN', `Unknown action type: ${actionTypeRaw}`);
    }

    const policy = this.getPolicy(actionTypeRaw);
    if (policy.phase !== 'phase2') {
      this.throwBadRequest(
        'ACTION_PHASE_UNSUPPORTED',
        'Structured command mode is reserved for phase2 tenant actions',
      );
    }

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(structuredMatch[2]);
    } catch {
      this.throwBadRequest('ACTION_PAYLOAD_JSON_INVALID', 'Payload JSON is invalid');
    }

    if (!this.isPlainObject(parsedPayload)) {
      this.throwBadRequest('ACTION_PAYLOAD_JSON_OBJECT_REQUIRED', 'Payload must be a JSON object');
    }

    return {
      actionType: actionTypeRaw,
      payload: parsedPayload,
      preview: this.buildActionPreview(actionTypeRaw, parsedPayload),
      requiresConfirmation: policy.requiresConfirmation,
    };
  }

  private parseChannelToggleFromMessage(normalized: string): ActionPlanResult | null {
    const looksLikeToggle =
      /(開啟|啟用|關閉|停用|enable|disable|turn on|turn off|\bon\b|\boff\b)/i.test(normalized) &&
      /(line|facebook|fb|whatsapp|頻道|channel|渠道|管道)/i.test(normalized);

    if (!looksLikeToggle) {
      return null;
    }

    const channelType = this.parseChannelType(normalized);
    if (!channelType) {
      return null;
    }

    const enabled = this.parseBooleanToggle(normalized);
    if (enabled === null) {
      this.throwBadRequest(
        'CHANNEL_TOGGLE_STATE_REQUIRED',
        'Cannot determine toggle state, please specify enable or disable explicitly',
      );
    }

    const botId = this.parseBotId(normalized);
    if (!botId) {
      this.throwBadRequest(
        'BOT_ID_REQUIRED',
        'Phase2 channel toggle requires explicit bot id, example: bot:id123',
      );
    }

    const policy = this.getPolicy('tenant_bot_channel_toggle');

    return {
      actionType: 'tenant_bot_channel_toggle',
      payload: {
        botId,
        channelType,
        enabled,
      },
      preview: `將${enabled ? '啟用' : '停用'} bot ${botId} 的 ${channelType} channel。`,
      requiresConfirmation: policy.requiresConfirmation,
    };
  }

  private parseAssistantConfigUpdateFromMessage(normalized: string): ActionPlanResult | null {
    const assistantConfig: Record<string, unknown> = {};

    const promptMatch = normalized.match(
      /(?:助理|助手|assistant)\s*(?:提示詞|提示|prompt)(?:改成|設成|設定為|改為|[:：=])\s*(.+)$/i,
    );
    if (promptMatch) {
      assistantConfig.prompt = promptMatch[1].trim();
    }

    const welcomeMatch = normalized.match(
      /(?:助理|助手|assistant)\s*(?:歡迎語|歡迎訊息|welcome(?:\s*message)?)(?:改成|設成|設定為|改為|[:：=])\s*(.+)$/i,
    );
    if (welcomeMatch) {
      assistantConfig.welcomeMessage = welcomeMatch[1].trim();
    }

    const scopeMatch = normalized.match(
      /(?:助理|助手|assistant)\s*(?:範圍|scope\s*notes?|導覽範圍)(?:改成|設成|設定為|改為|[:：=])\s*(.+)$/i,
    );
    if (scopeMatch) {
      assistantConfig.scopeNotes = scopeMatch[1].trim();
    }

    if (Object.keys(assistantConfig).length === 0) {
      return null;
    }

    const policy = this.getPolicy('tenant_assistant_config_update');

    return {
      actionType: 'tenant_assistant_config_update',
      payload: {
        assistantConfig,
      },
      preview: this.buildActionPreview('tenant_assistant_config_update', {
        assistantConfig,
      }),
      requiresConfirmation: policy.requiresConfirmation,
    };
  }

  private parseKbBindingCommand(normalized: string): ActionPlanResult | null {
    const commandMatch = normalized.match(
      /^(?:kb-bind|kb\s+bind)\s+bot(?:_id)?[:=]([A-Za-z0-9_-]{2,64})\s+ids[:=]([A-Za-z0-9_,\-\s]+)$/i,
    );
    if (!commandMatch) {
      return null;
    }

    const botId = commandMatch[1];
    const knowledgeBaseIds = commandMatch[2]
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    const policy = this.getPolicy('tenant_kb_binding_update');

    return {
      actionType: 'tenant_kb_binding_update',
      payload: {
        botId,
        knowledgeBaseIds,
      },
      preview: `將更新 bot ${botId} 的知識庫綁定（${knowledgeBaseIds.length} 筆）。`,
      requiresConfirmation: policy.requiresConfirmation,
    };
  }

  private parseChannelConfigUpdateFromMessage(normalized: string): ActionPlanResult | null {
    const looksLikeConfigUpdate =
      /(設定|更新|修改|config|setting|設定檔|設定值)/i.test(normalized) &&
      /(line|facebook|fb|whatsapp|頻道|channel|渠道|管道)/i.test(normalized);

    if (!looksLikeConfigUpdate) {
      return null;
    }

    const channelType = this.parseChannelType(normalized);
    if (!channelType) {
      return null;
    }

    const botId = this.parseBotId(normalized);
    if (!botId) {
      this.throwBadRequest(
        'BOT_ID_REQUIRED',
        'Phase2 channel config update requires explicit bot id, example: bot:id123',
      );
    }

    // Try to find a JSON config in the message
    let config: Record<string, unknown> = {};
    const jsonMatch = normalized.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        config = JSON.parse(jsonMatch[0]);
      } catch {
        this.throwBadRequest('ACTION_PAYLOAD_JSON_INVALID', 'Config JSON is invalid');
      }
    }

    if (Object.keys(config).length === 0) {
      this.throwBadRequest(
        'CHANNEL_CONFIG_REQUIRED',
        'Phase2 channel config update requires a config object. Example: action tenant_bot_channel_config_update {"key":"value"}',
      );
    }

    const policy = this.getPolicy('tenant_bot_channel_config_update');

    return {
      actionType: 'tenant_bot_channel_config_update',
      payload: {
        botId,
        channelType,
        config,
      },
      preview: this.buildActionPreview('tenant_bot_channel_config_update', {
        botId,
        channelType,
        config,
      }),
      requiresConfirmation: policy.requiresConfirmation,
    };
  }

  private parseLanguageValue(raw: string): 'zh-TW' | 'en-US' | null {
    const value = raw.toLowerCase();
    if (value.includes('中文') || value.includes('繁中') || value.includes('zh')) {
      return 'zh-TW';
    }

    if (value.includes('英文') || value.includes('english') || value.includes('en')) {
      return 'en-US';
    }

    return null;
  }

  private buildActionPreview(actionType: AssistantActionType, payload: Record<string, unknown>): string {
    if (actionType === 'tenant_bot_channel_toggle') {
      const botId = String(payload.botId || '').trim();
      const channelType = String(payload.channelType || '').trim();
      const enabled = Boolean(payload.enabled);
      return `將${enabled ? '啟用' : '停用'} bot ${botId} 的 ${channelType} channel。`;
    }

    if (actionType === 'tenant_bot_channel_config_update') {
      const botId = String(payload.botId || '').trim();
      const channelType = String(payload.channelType || '').trim();
      return `將替換 bot ${botId} 的 ${channelType} channel 設定（敏感欄位將遮罩）。`;
    }

    if (actionType === 'tenant_assistant_config_update') {
      const assistantConfig = this.isPlainObject(payload.assistantConfig)
        ? payload.assistantConfig
        : {};
      const fields = Object.keys(assistantConfig);
      const fieldLabel = fields.length ? fields.join(', ') : 'assistantConfig';
      return `將更新網站助理設定欄位：${fieldLabel}。`;
    }

    if (actionType === 'tenant_kb_binding_update') {
      const botId = String(payload.botId || '').trim();
      const ids = Array.isArray(payload.knowledgeBaseIds) ? payload.knowledgeBaseIds : [];
      return `將更新 bot ${botId} 的知識庫綁定（${ids.length} 筆）。`;
    }

    return `將執行動作：${actionType}`;
  }

  private parseMessageToAction(message: string): ActionPlanResult {
    const normalized = message.trim();
    const lower = normalized.toLowerCase();

    const structured = this.parseStructuredActionCommand(normalized);
    if (structured) {
      return structured;
    }

    if (/我的資料|個人資料|profile|我是誰/.test(normalized)) {
      return {
        actionType: 'get_my_profile',
        payload: {},
        preview: '將查詢你的個人帳戶資料。',
        requiresConfirmation: this.getPolicy('get_my_profile').requiresConfirmation,
      };
    }

    const displayNameMatch = normalized.match(/(?:顯示名稱|名字|名稱)(?:改成|設成|設定為|改為)\s*[:：]?\s*(.+)$/i);
    if (displayNameMatch) {
      const displayName = displayNameMatch[1].trim();
      if (displayName.length < 1 || displayName.length > 60) {
        throw new BadRequestException('顯示名稱長度需介於 1 到 60 字元');
      }

      return {
        actionType: 'update_my_display_name',
        payload: { displayName },
        preview: `將把你的顯示名稱更新為「${displayName}」。`,
        requiresConfirmation: this.getPolicy('update_my_display_name').requiresConfirmation,
      };
    }

    if (/語言|language/.test(normalized)) {
      const language = this.parseLanguageValue(normalized);
      if (!language) {
        throw new BadRequestException('請指定語言，例如：改成中文 或 改成英文');
      }

      return {
        actionType: 'update_my_language',
        payload: { language },
        preview: `將把你的偏好語言更新為 ${language}。`,
        requiresConfirmation: this.getPolicy('update_my_language').requiresConfirmation,
      };
    }

    if (/通知|notification/.test(lower)) {
      const enabled = /(開|啟用|on|enable|true)/.test(lower)
        ? true
        : /(關|停用|off|disable|false)/.test(lower)
          ? false
          : null;

      if (enabled === null) {
        throw new BadRequestException('請指定通知開啟或關閉，例如：把通知打開');
      }

      return {
        actionType: 'update_my_notification_pref',
        payload: { notificationsEnabled: enabled },
        preview: `將把你的通知偏好設定為${enabled ? '開啟' : '關閉'}。`,
        requiresConfirmation: this.getPolicy('update_my_notification_pref').requiresConfirmation,
      };
    }

    const phase2Toggle = this.parseChannelToggleFromMessage(normalized);
    if (phase2Toggle) {
      return phase2Toggle;
    }

    const phase2ConfigUpdate = this.parseChannelConfigUpdateFromMessage(normalized);
    if (phase2ConfigUpdate) {
      return phase2ConfigUpdate;
    }

    const phase2AssistantUpdate = this.parseAssistantConfigUpdateFromMessage(normalized);
    if (phase2AssistantUpdate) {
      return phase2AssistantUpdate;
    }

    const phase2KbBinding = this.parseKbBindingCommand(normalized);
    if (phase2KbBinding) {
      return phase2KbBinding;
    }

    throw new BadRequestException(
      '目前支援：Phase1 個人設定動作；Phase2 請使用 action <type> <json> 或 kb-bind 指令。',
    );
  }

  private assertActionSpecificPayload(actionType: AssistantActionType, payload: Record<string, unknown>): void {
    if (actionType === 'update_my_display_name') {
      const displayName = String(payload.displayName || '').trim();
      if (!displayName || displayName.length > 60) {
        this.throwBadRequest('DISPLAY_NAME_INVALID', 'displayName length must be between 1 and 60');
      }
      return;
    }

    if (actionType === 'update_my_language') {
      const language = String(payload.language || '').trim();
      if (!['zh-TW', 'en-US'].includes(language)) {
        this.throwBadRequest('LANGUAGE_INVALID', 'language must be zh-TW or en-US');
      }
      return;
    }

    if (actionType === 'tenant_bot_channel_toggle') {
      const botId = String(payload.botId || '').trim();
      const channelType = this.parseChannelType(String(payload.channelType || ''));
      if (!botId) {
        this.throwBadRequest('BOT_ID_REQUIRED', 'botId is required');
      }

      if (!channelType || !PHASE2_ALLOWED_CHANNELS.includes(channelType)) {
        this.throwBadRequest('CHANNEL_TYPE_INVALID', 'channelType must be one of line/facebook/whatsapp');
      }

      if (typeof payload.enabled !== 'boolean') {
        this.throwBadRequest('CHANNEL_ENABLED_INVALID', 'enabled must be boolean');
      }

      return;
    }

    if (actionType === 'tenant_bot_channel_config_update') {
      const botId = String(payload.botId || '').trim();
      const channelType = this.parseChannelType(String(payload.channelType || ''));
      const config = payload.config;

      if (!botId) {
        this.throwBadRequest('BOT_ID_REQUIRED', 'botId is required');
      }

      if (!channelType || !PHASE2_ALLOWED_CHANNELS.includes(channelType)) {
        this.throwBadRequest('CHANNEL_TYPE_INVALID', 'channelType must be one of line/facebook/whatsapp');
      }

      if (!this.isPlainObject(config) || Object.keys(config).length === 0) {
        this.throwBadRequest('CHANNEL_CONFIG_INVALID', 'config must be a non-empty object');
      }

      return;
    }

    if (actionType === 'tenant_assistant_config_update') {
      const assistantConfig = payload.assistantConfig;
      if (!this.isPlainObject(assistantConfig)) {
        this.throwBadRequest('ASSISTANT_CONFIG_INVALID', 'assistantConfig must be an object');
      }

      const allowedFields = new Set(['prompt', 'welcomeMessage', 'scopeNotes']);
      const providedFields = Object.keys(assistantConfig);

      if (!providedFields.length) {
        this.throwBadRequest('ASSISTANT_CONFIG_EMPTY', 'assistantConfig must include at least one field');
      }

      for (const field of providedFields) {
        if (!allowedFields.has(field)) {
          this.throwBadRequest(
            'ASSISTANT_CONFIG_FIELD_NOT_ALLOWED',
            `assistantConfig field "${field}" is not allowed`,
          );
        }

        const value = assistantConfig[field];
        if (typeof value !== 'string' || !value.trim()) {
          this.throwBadRequest(
            'ASSISTANT_CONFIG_VALUE_INVALID',
            `assistantConfig.${field} must be a non-empty string`,
          );
        }

        if (field === 'prompt' && value.trim().length > 4000) {
          this.throwBadRequest('ASSISTANT_CONFIG_PROMPT_TOO_LONG', 'prompt exceeds 4000 characters');
        }

        if (field === 'welcomeMessage' && value.trim().length > 1000) {
          this.throwBadRequest(
            'ASSISTANT_CONFIG_WELCOME_TOO_LONG',
            'welcomeMessage exceeds 1000 characters',
          );
        }

        if (field === 'scopeNotes' && value.trim().length > 2000) {
          this.throwBadRequest('ASSISTANT_CONFIG_SCOPE_TOO_LONG', 'scopeNotes exceeds 2000 characters');
        }
      }

      return;
    }

    if (actionType === 'tenant_kb_binding_update') {
      const botId = String(payload.botId || '').trim();
      const knowledgeBaseIds = payload.knowledgeBaseIds;

      if (!botId) {
        this.throwBadRequest('BOT_ID_REQUIRED', 'botId is required');
      }

      if (!Array.isArray(knowledgeBaseIds) || !knowledgeBaseIds.length) {
        this.throwBadRequest('KB_BINDING_IDS_REQUIRED', 'knowledgeBaseIds must be a non-empty array');
      }

      if (knowledgeBaseIds.length > 20) {
        this.throwBadRequest('KB_BINDING_IDS_TOO_MANY', 'knowledgeBaseIds cannot exceed 20 items');
      }

      const normalizedIds = knowledgeBaseIds.map((item) => String(item || '').trim());
      const seen = new Set<string>();
      for (const id of normalizedIds) {
        if (!id || !/^[A-Za-z0-9_-]{2,80}$/.test(id)) {
          this.throwBadRequest('KB_BINDING_ID_INVALID', 'knowledgeBaseIds contains invalid id');
        }

        if (seen.has(id)) {
          this.throwBadRequest('KB_BINDING_ID_DUPLICATE', 'knowledgeBaseIds cannot contain duplicates');
        }

        seen.add(id);
      }
    }
  }

  private isSensitiveField(key: string): boolean {
    return SENSITIVE_FIELD_PATTERN.test(key);
  }

  private maskSensitiveData(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.maskSensitiveData(item));
    }

    if (!this.isPlainObject(value)) {
      return value;
    }

    const masked: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      if (this.isSensitiveField(key)) {
        masked[key] = '[REDACTED]';
        continue;
      }

      masked[key] = this.maskSensitiveData(nestedValue);
    }

    return masked;
  }

  private normalizeJsonValue(value: unknown): unknown {
    if (typeof value !== 'string') {
      return value;
    }

    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  private normalizeObjectValue(value: unknown): Record<string, unknown> {
    const normalized = this.normalizeJsonValue(value);
    if (!this.isPlainObject(normalized)) {
      return {};
    }

    return normalized;
  }

  private generateConfirmationToken(): string {
    const random = randomBytes(CONFIRMATION_TOKEN_LENGTH);
    let token = '';

    for (let index = 0; index < CONFIRMATION_TOKEN_LENGTH; index += 1) {
      const byte = random[index];
      token += CONFIRMATION_TOKEN_ALPHABET[byte % CONFIRMATION_TOKEN_ALPHABET.length];
    }

    return token;
  }

  private hashConfirmationToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private requiresConfirmationToken(actionType: AssistantActionType): boolean {
    const policy = this.getPolicy(actionType);
    return policy.phase === 'phase2' || policy.riskLevel === 'high';
  }

  private async incrementConfirmationAttempt(actionId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE assistant_action_pending
       SET confirmation_attempts = COALESCE(confirmation_attempts, 0) + 1
       WHERE id = $1`,
      [actionId],
    );
  }

  private async assertNoActiveRiskyPending(
    tenantSchema: string,
    userId: string,
    actionType: AssistantActionType,
  ): Promise<void> {
    const policy = this.getPolicy(actionType);
    if (policy.phase !== 'phase2' || policy.riskLevel !== 'high') {
      return;
    }

    const rows = await this.dataSource.query(
      `SELECT COUNT(1)::int AS count
       FROM assistant_action_pending
       WHERE tenant_schema = $1
         AND user_id = $2
         AND action_type = $3
         AND status IN ('pending', 'processing')
         AND expires_at > NOW()`,
      [tenantSchema, userId, actionType],
    );

    const count = Number(rows?.[0]?.count || 0);
    if (count > 0) {
      this.throwBadRequest(
        'RISK_GUARDRAIL_PENDING_EXISTS',
        'A high-risk pending action already exists; confirm or wait for expiration before creating another',
      );
    }
  }

  private async ensureActionTables(): Promise<void> {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS assistant_action_pending (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_schema VARCHAR(63) NOT NULL,
        user_id UUID NOT NULL,
        action_type VARCHAR(64) NOT NULL,
        phase VARCHAR(20),
        scope VARCHAR(20),
        risk_level VARCHAR(20),
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        confirmation_token_hash VARCHAR(128),
        token_expires_at TIMESTAMP WITH TIME ZONE,
        confirmation_attempts INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        confirmed_at TIMESTAMP WITH TIME ZONE
      )
    `);

    await this.dataSource.query(
      `ALTER TABLE assistant_action_pending ADD COLUMN IF NOT EXISTS phase VARCHAR(20)`,
    );
    await this.dataSource.query(
      `ALTER TABLE assistant_action_pending ADD COLUMN IF NOT EXISTS scope VARCHAR(20)`,
    );
    await this.dataSource.query(
      `ALTER TABLE assistant_action_pending ADD COLUMN IF NOT EXISTS risk_level VARCHAR(20)`,
    );
    await this.dataSource.query(
      `ALTER TABLE assistant_action_pending ADD COLUMN IF NOT EXISTS confirmation_token_hash VARCHAR(128)`,
    );
    await this.dataSource.query(
      `ALTER TABLE assistant_action_pending ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP WITH TIME ZONE`,
    );
    await this.dataSource.query(
      `ALTER TABLE assistant_action_pending ADD COLUMN IF NOT EXISTS confirmation_attempts INTEGER NOT NULL DEFAULT 0`,
    );

    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_assistant_action_pending_tenant_user
      ON assistant_action_pending(tenant_schema, user_id, created_at DESC)
    `);

    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_assistant_action_pending_status
      ON assistant_action_pending(tenant_schema, user_id, status, expires_at)
    `);

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS assistant_action_audit_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_schema VARCHAR(63) NOT NULL,
        user_id UUID NOT NULL,
        action_type VARCHAR(64) NOT NULL,
        phase VARCHAR(20),
        scope VARCHAR(20),
        risk_level VARCHAR(20),
        request_message TEXT,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        status VARCHAR(20) NOT NULL,
        classification VARCHAR(30),
        error_code VARCHAR(64),
        result JSONB,
        error_message TEXT,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await this.dataSource.query(
      `ALTER TABLE assistant_action_audit_logs ADD COLUMN IF NOT EXISTS phase VARCHAR(20)`,
    );
    await this.dataSource.query(
      `ALTER TABLE assistant_action_audit_logs ADD COLUMN IF NOT EXISTS scope VARCHAR(20)`,
    );
    await this.dataSource.query(
      `ALTER TABLE assistant_action_audit_logs ADD COLUMN IF NOT EXISTS risk_level VARCHAR(20)`,
    );
    await this.dataSource.query(
      `ALTER TABLE assistant_action_audit_logs ADD COLUMN IF NOT EXISTS classification VARCHAR(30)`,
    );
    await this.dataSource.query(
      `ALTER TABLE assistant_action_audit_logs ADD COLUMN IF NOT EXISTS error_code VARCHAR(64)`,
    );
    await this.dataSource.query(
      `ALTER TABLE assistant_action_audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB`,
    );

    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_assistant_action_audit_tenant_user
      ON assistant_action_audit_logs(tenant_schema, user_id, created_at DESC)
    `);

    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_assistant_action_audit_security
      ON assistant_action_audit_logs(tenant_schema, classification, created_at DESC)
    `);
  }

  private async getTenantSettings(tenantSchema: string): Promise<Record<string, unknown>> {
    const rows = await this.dataSource.query(
      `SELECT settings FROM tenants WHERE schema_name = $1 LIMIT 1`,
      [tenantSchema],
    );
    return (rows?.[0]?.settings || {}) as Record<string, unknown>;
  }

  private async setTenantSettings(tenantSchema: string, settings: Record<string, unknown>): Promise<void> {
    await this.dataSource.query(`UPDATE tenants SET settings = $1::jsonb WHERE schema_name = $2`, [
      JSON.stringify(settings),
      tenantSchema,
    ]);
  }

  private getWebsiteBots(settings: Record<string, unknown>): Record<string, unknown>[] {
    const rawBots = settings.website_bots;
    if (!Array.isArray(rawBots)) {
      return [];
    }

    const bots: Record<string, unknown>[] = [];
    for (const rawBot of rawBots) {
      if (this.isPlainObject(rawBot)) {
        bots.push({ ...rawBot });
      }
    }

    return bots;
  }

  private findBotOrThrow(bots: Record<string, unknown>[], botId: string): Record<string, unknown> {
    const bot = bots.find((item) => String(item.id || '').trim() === botId);
    if (!bot) {
      this.throwBadRequest('BOT_NOT_FOUND', `Bot "${botId}" not found in tenant settings`);
    }

    return bot;
  }

  private assertSensitiveConfigReplaceOnly(
    existingConfig: Record<string, unknown>,
    replacementConfig: Record<string, unknown>,
  ): void {
    const existingSensitiveKeys = Object.keys(existingConfig).filter((key) => this.isSensitiveField(key));
    const replacementSensitiveKeys = Object.keys(replacementConfig).filter((key) =>
      this.isSensitiveField(key),
    );
    const requiredSensitiveKeys = Array.from(
      new Set([...existingSensitiveKeys, ...replacementSensitiveKeys]),
    );

    for (const key of requiredSensitiveKeys) {
      if (!Object.prototype.hasOwnProperty.call(replacementConfig, key)) {
        this.throwBadRequest(
          'SENSITIVE_CONFIG_REPLACE_ONLY',
          `Sensitive field "${key}" must be provided in replace-only updates`,
        );
      }

      const value = replacementConfig[key];
      if (typeof value !== 'string' || !value.trim()) {
        this.throwBadRequest(
          'SENSITIVE_CONFIG_VALUE_REQUIRED',
          `Sensitive field "${key}" must be a non-empty string`,
        );
      }
    }
  }

  private extractExceptionDetails(error: unknown): { message: string; code?: string } {
    if (
      error instanceof BadRequestException ||
      error instanceof ForbiddenException ||
      error instanceof NotFoundException
    ) {
      const response = error.getResponse() as
        | string
        | {
            message?: string | string[];
            code?: string;
          };

      if (typeof response === 'string') {
        return {
          message: response,
        };
      }

      const message = Array.isArray(response.message)
        ? response.message.join('; ')
        : response.message || error.message;

      return {
        message,
        code: response.code,
      };
    }

    if (error instanceof Error) {
      return {
        message: error.message,
      };
    }

    return {
      message: 'Unknown assistant action error',
    };
  }

  private inferErrorCode(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes('expired')) {
      return 'CONFIRMATION_EXPIRED';
    }

    if (lower.includes('token')) {
      return 'CONFIRMATION_TOKEN_INVALID';
    }

    if (lower.includes('role') || lower.includes('allowed')) {
      return 'ACTION_ROLE_DENIED';
    }

    if (lower.includes('schema') || lower.includes('payload')) {
      return 'PAYLOAD_SCHEMA_INVALID';
    }

    if (lower.includes('replay') || lower.includes('processed')) {
      return 'ACTION_REPLAY_BLOCKED';
    }

    return 'ASSISTANT_ACTION_BAD_REQUEST';
  }

  private classifyError(error: unknown): ActionSecurityError {
    const details = this.extractExceptionDetails(error);
    const normalizedCode = (details.code || this.inferErrorCode(details.message)).toUpperCase();

    if (error instanceof ForbiddenException) {
      return {
        status: 'denied',
        classification: 'authorization',
        errorCode: normalizedCode,
        errorMessage: details.message,
      };
    }

    if (error instanceof NotFoundException) {
      return {
        status: 'rejected',
        classification: 'validation',
        errorCode: normalizedCode || 'ACTION_NOT_FOUND',
        errorMessage: details.message,
      };
    }

    if (error instanceof BadRequestException) {
      const securityCodes = new Set([
        'ACTION_DENY_BY_DEFAULT',
        'ACTION_ROLE_DENIED',
        'CONFIRMATION_TOKEN_REQUIRED',
        'CONFIRMATION_TOKEN_INVALID',
        'CONFIRMATION_EXPIRED',
        'ACTION_REPLAY_BLOCKED',
        'RISK_GUARDRAIL_CHANNEL_LOCKOUT',
        'RISK_GUARDRAIL_PENDING_EXISTS',
        'SENSITIVE_CONFIG_REPLACE_ONLY',
        'SENSITIVE_CONFIG_VALUE_REQUIRED',
      ]);

      const isSecurityEvent = securityCodes.has(normalizedCode);

      return {
        status: normalizedCode === 'CONFIRMATION_EXPIRED' ? 'expired' : isSecurityEvent ? 'denied' : 'rejected',
        classification: isSecurityEvent ? 'security' : 'validation',
        errorCode: normalizedCode,
        errorMessage: details.message,
      };
    }

    return {
      status: 'failed',
      classification: 'system',
      errorCode: 'ASSISTANT_ACTION_INTERNAL_ERROR',
      errorMessage: details.message,
    };
  }

  private async writeAuditLog(args: {
    tenantSchema: string;
    userId: string;
    actionType: AssistantActionType;
    phase: string;
    scope: string;
    riskLevel: string;
    requestMessage?: string;
    payload: Record<string, unknown>;
    status: AssistantAuditStatus;
    classification: AssistantAuditClassification;
    result?: Record<string, unknown>;
    errorCode?: string;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.ensureActionTables();

    const maskedPayload = this.maskSensitiveData(args.payload || {}) as Record<string, unknown>;
    const maskedResult = args.result
      ? (this.maskSensitiveData(args.result) as Record<string, unknown>)
      : null;
    const maskedMetadata = args.metadata
      ? (this.maskSensitiveData(args.metadata) as Record<string, unknown>)
      : null;

    await this.dataSource.query(
      `INSERT INTO assistant_action_audit_logs
       (tenant_schema, user_id, action_type, phase, scope, risk_level, request_message, payload, status, classification, error_code, result, error_message, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        args.tenantSchema,
        args.userId,
        args.actionType,
        args.phase,
        args.scope,
        args.riskLevel,
        args.requestMessage || null,
        JSON.stringify(maskedPayload),
        args.status,
        args.classification,
        args.errorCode || null,
        maskedResult ? JSON.stringify(maskedResult) : null,
        args.errorMessage || null,
        maskedMetadata ? JSON.stringify(maskedMetadata) : null,
      ],
    );
  }

  private async safeWriteAuditLog(args: {
    tenantSchema: string;
    userId: string;
    actionType: AssistantActionType;
    phase: string;
    scope: string;
    riskLevel: string;
    requestMessage?: string;
    payload: Record<string, unknown>;
    status: AssistantAuditStatus;
    classification: AssistantAuditClassification;
    result?: Record<string, unknown>;
    errorCode?: string;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.writeAuditLog(args);
    } catch {
      // Never shadow the original execution error with audit persistence failures.
    }
  }

  private async executeAction(args: {
    tenantSchema: string;
    user: AuthUser;
    actionType: AssistantActionType;
    payload: Record<string, unknown>;
    confirmedExecution: boolean;
  }): Promise<Record<string, unknown>> {
    const { tenantSchema, user, actionType, payload, confirmedExecution } = args;
    this.assertTenantSchema(tenantSchema);
    this.assertUser(user);

    const policy = this.assertAllowed(actionType, user);
    this.assertPayloadSchema(actionType, payload);
    this.assertActionSpecificPayload(actionType, payload);

    if (policy.requiresConfirmation && !confirmedExecution) {
      this.throwForbidden(
        'CONFIRMATION_REQUIRED',
        `Action "${actionType}" requires confirmation before execution`,
      );
    }

    if (actionType === 'get_my_profile') {
      const rows = await this.dataSource.query(
        `SELECT id, email, name, role, is_active, created_at
         FROM ${tenantSchema}.users
         WHERE id = $1
         LIMIT 1`,
        [user.sub],
      );
      if (!rows?.length) {
        throw new NotFoundException('User profile not found');
      }

      const settings = await this.getTenantSettings(tenantSchema);
      const userPreferences = ((settings.user_preferences as Record<string, unknown>) || {}) as Record<
        string,
        Record<string, unknown>
      >;
      const myPreference = userPreferences[user.sub] || {};

      return {
        profile: rows[0],
        preferences: {
          language: myPreference.language || 'zh-TW',
          notificationsEnabled: myPreference.notificationsEnabled ?? true,
        },
      };
    }

    if (actionType === 'update_my_display_name') {
      const displayName = String(payload.displayName || '').trim();
      if (!displayName) {
        throw new BadRequestException('displayName is required');
      }

      const rows = await this.dataSource.query(
        `UPDATE ${tenantSchema}.users
         SET name = $1
         WHERE id = $2
         RETURNING id, email, name, role, is_active`,
        [displayName, user.sub],
      );

      if (!rows?.length) {
        throw new NotFoundException('User profile not found');
      }

      return { updatedProfile: rows[0] };
    }

    if (actionType === 'update_my_language' || actionType === 'update_my_notification_pref') {
      const settings = await this.getTenantSettings(tenantSchema);
      const userPreferences = ((settings.user_preferences as Record<string, unknown>) || {}) as Record<
        string,
        Record<string, unknown>
      >;
      const currentUserPref = userPreferences[user.sub] || {};

      if (actionType === 'update_my_language') {
        currentUserPref.language = String(payload.language || 'zh-TW');
      }

      if (actionType === 'update_my_notification_pref') {
        currentUserPref.notificationsEnabled = Boolean(payload.notificationsEnabled);
      }

      userPreferences[user.sub] = currentUserPref;
      settings.user_preferences = userPreferences;
      await this.setTenantSettings(tenantSchema, settings);

      return {
        preferences: {
          language: currentUserPref.language || 'zh-TW',
          notificationsEnabled: currentUserPref.notificationsEnabled ?? true,
        },
      };
    }

    if (actionType === 'tenant_bot_channel_toggle') {
      const botId = String(payload.botId || '').trim();
      const channelType = this.parseChannelType(String(payload.channelType || ''));
      const enabled = Boolean(payload.enabled);

      if (!channelType) {
        this.throwBadRequest('CHANNEL_TYPE_INVALID', 'channelType must be line/facebook/whatsapp');
      }

      const settings = await this.getTenantSettings(tenantSchema);
      const websiteBots = this.getWebsiteBots(settings);
      const bot = this.findBotOrThrow(websiteBots, botId);

      const rawChannels = Array.isArray(bot.channels) ? bot.channels : [];
      const channels: Record<string, unknown>[] = [];
      for (const rawChannel of rawChannels) {
        if (this.isPlainObject(rawChannel)) {
          channels.push({ ...rawChannel });
        }
      }

      let targetChannel = channels.find(
        (channel) => this.parseChannelType(String(channel.type || '')) === channelType,
      );

      if (!targetChannel) {
        targetChannel = {
          type: channelType,
          enabled: false,
        };
        channels.push(targetChannel);
      }

      if (!enabled) {
        const hasOtherEnabledChannel = channels.some(
          (channel) =>
            this.parseChannelType(String(channel.type || '')) !== channelType &&
            Boolean(channel.enabled),
        );

        if (!hasOtherEnabledChannel) {
          this.throwBadRequest(
            'RISK_GUARDRAIL_CHANNEL_LOCKOUT',
            'Cannot disable the last enabled external channel for this bot',
          );
        }
      }

      targetChannel.type = channelType;
      targetChannel.enabled = enabled;
      bot.channels = channels;

      settings.website_bots = websiteBots;
      await this.setTenantSettings(tenantSchema, settings);

      return {
        botId,
        channelType,
        enabled,
        channels: channels.map((channel) => ({
          type: this.parseChannelType(String(channel.type || '')) || String(channel.type || ''),
          enabled: Boolean(channel.enabled),
        })),
      };
    }

    if (actionType === 'tenant_bot_channel_config_update') {
      const botId = String(payload.botId || '').trim();
      const channelType = this.parseChannelType(String(payload.channelType || ''));
      const replacementConfig = payload.config as Record<string, unknown>;

      if (!channelType) {
        this.throwBadRequest('CHANNEL_TYPE_INVALID', 'channelType must be line/facebook/whatsapp');
      }

      const settings = await this.getTenantSettings(tenantSchema);
      const websiteBots = this.getWebsiteBots(settings);
      const bot = this.findBotOrThrow(websiteBots, botId);

      const channelConfigs = this.isPlainObject(bot.channelConfigs) ? { ...bot.channelConfigs } : {};
      const existingConfigRaw = channelConfigs[channelType];
      const existingConfig = this.isPlainObject(existingConfigRaw)
        ? (existingConfigRaw as Record<string, unknown>)
        : {};

      this.assertSensitiveConfigReplaceOnly(existingConfig, replacementConfig);

      channelConfigs[channelType] = { ...replacementConfig };
      bot.channelConfigs = channelConfigs;

      settings.website_bots = websiteBots;
      await this.setTenantSettings(tenantSchema, settings);

      return {
        botId,
        channelType,
        replaceMode: 'replace-only',
        config: this.maskSensitiveData(replacementConfig),
      };
    }

    if (actionType === 'tenant_assistant_config_update') {
      const settings = await this.getTenantSettings(tenantSchema);
      const assistantConfigUpdate = payload.assistantConfig as Record<string, unknown>;

      const currentAssistantConfig = this.isPlainObject(settings.website_assistant)
        ? ({ ...settings.website_assistant } as Record<string, unknown>)
        : {};

      const nextAssistantConfig: Record<string, unknown> = {
        ...currentAssistantConfig,
      };

      if (typeof assistantConfigUpdate.prompt === 'string' && assistantConfigUpdate.prompt.trim()) {
        nextAssistantConfig.prompt = assistantConfigUpdate.prompt.trim();
      }

      if (
        typeof assistantConfigUpdate.welcomeMessage === 'string' &&
        assistantConfigUpdate.welcomeMessage.trim()
      ) {
        nextAssistantConfig.welcomeMessage = assistantConfigUpdate.welcomeMessage.trim();
      }

      if (typeof assistantConfigUpdate.scopeNotes === 'string' && assistantConfigUpdate.scopeNotes.trim()) {
        nextAssistantConfig.scopeNotes = assistantConfigUpdate.scopeNotes.trim();
      }

      settings.website_assistant = nextAssistantConfig;
      if (typeof nextAssistantConfig.prompt === 'string' && nextAssistantConfig.prompt) {
        settings.system_prompt = nextAssistantConfig.prompt;
      }

      await this.setTenantSettings(tenantSchema, settings);

      return {
        assistantConfig: nextAssistantConfig,
      };
    }

    if (actionType === 'tenant_kb_binding_update') {
      const botId = String(payload.botId || '').trim();
      const knowledgeBaseIdsRaw = payload.knowledgeBaseIds as unknown[];
      const knowledgeBaseIds = Array.from(
        new Set(
          knowledgeBaseIdsRaw
            .map((id) => String(id || '').trim())
            .filter((id) => /^[A-Za-z0-9_-]{2,80}$/.test(id)),
        ),
      );

      const settings = await this.getTenantSettings(tenantSchema);
      const websiteBots = this.getWebsiteBots(settings);
      const bot = this.findBotOrThrow(websiteBots, botId);

      bot.knowledgeBaseIds = knowledgeBaseIds;
      settings.website_bots = websiteBots;
      await this.setTenantSettings(tenantSchema, settings);

      return {
        botId,
        knowledgeBaseIds,
        totalBindings: knowledgeBaseIds.length,
      };
    }

    throw new BadRequestException('Unsupported action type');
  }

  async planAction(message: string, context: PlanContext) {
    const { tenantSchema, user } = context;
    this.assertTenantSchema(tenantSchema);
    this.assertUser(user);
    await this.ensureActionTables();

    let plan: ActionPlanResult | undefined;
    let policy: AssistantActionDefinition | undefined;

    try {
      plan = this.parseMessageToAction(message);
      policy = this.assertAllowed(plan.actionType, user);
      this.assertPayloadSchema(plan.actionType, plan.payload);
      this.assertActionSpecificPayload(plan.actionType, plan.payload);

      if (!policy.requiresConfirmation) {
        const result = await this.executeAction({
          tenantSchema,
          user,
          actionType: plan.actionType,
          payload: plan.payload,
          confirmedExecution: true,
        });

        await this.writeAuditLog({
          tenantSchema,
          userId: user.sub,
          actionType: plan.actionType,
          phase: policy.phase,
          scope: policy.scope,
          riskLevel: policy.riskLevel,
          requestMessage: message,
          payload: plan.payload,
          status: 'executed',
          classification: 'success',
          result,
        });

        return {
          success: true,
          mode: 'executed',
          actionType: plan.actionType,
          preview: plan.preview,
          result,
        };
      }

      await this.assertNoActiveRiskyPending(tenantSchema, user.sub, plan.actionType);

      const requiresConfirmationToken = this.requiresConfirmationToken(plan.actionType);
      const confirmationToken = requiresConfirmationToken ? this.generateConfirmationToken() : undefined;
      const confirmationTokenHash = confirmationToken
        ? this.hashConfirmationToken(confirmationToken)
        : null;

      const pendingRows = await this.dataSource.query(
        `INSERT INTO assistant_action_pending
         (tenant_schema, user_id, action_type, phase, scope, risk_level, payload, status, expires_at, confirmation_token_hash, token_expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'pending', NOW() + ($8 * INTERVAL '1 second'), $9, NOW() + ($8 * INTERVAL '1 second'))
         RETURNING id, expires_at, token_expires_at`,
        [
          tenantSchema,
          user.sub,
          plan.actionType,
          policy.phase,
          policy.scope,
          policy.riskLevel,
          JSON.stringify(plan.payload),
          CONFIRMATION_WINDOW_SECONDS,
          confirmationTokenHash,
        ],
      );

      const pending = pendingRows?.[0];

      await this.writeAuditLog({
        tenantSchema,
        userId: user.sub,
        actionType: plan.actionType,
        phase: policy.phase,
        scope: policy.scope,
        riskLevel: policy.riskLevel,
        requestMessage: message,
        payload: plan.payload,
        status: 'planned',
        classification: 'success',
        result: {
          pendingActionId: pending.id,
          requiresConfirmationToken,
        },
        metadata: {
          confirmationTtlSeconds: CONFIRMATION_WINDOW_SECONDS,
          requiresConfirmationToken,
        },
      });

      return {
        success: true,
        mode: 'pending_confirmation',
        actionId: pending.id,
        expiresAt: pending.expires_at,
        tokenExpiresAt: pending.token_expires_at || pending.expires_at,
        actionType: plan.actionType,
        preview: plan.preview,
        confirmInstruction: requiresConfirmationToken
          ? '請呼叫 confirm API 並帶入 actionId 與 confirmationToken 以套用設定。'
          : '請呼叫 confirm API 並帶入 actionId 以套用設定。',
        confirmationToken,
        requiresConfirmationToken,
        riskLevel: policy.riskLevel,
        phase: policy.phase,
      };
    } catch (error) {
      if (plan && policy) {
        const securityError = this.classifyError(error);
        await this.safeWriteAuditLog({
          tenantSchema,
          userId: user.sub,
          actionType: plan.actionType,
          phase: policy.phase,
          scope: policy.scope,
          riskLevel: policy.riskLevel,
          requestMessage: message,
          payload: plan.payload,
          status: securityError.status,
          classification: securityError.classification,
          errorCode: securityError.errorCode,
          errorMessage: securityError.errorMessage,
          metadata: {
            stage: 'plan',
          },
        });
      }

      throw error;
    }
  }

  async planTenantBotChannelToggle(
    body: {
      botId: string;
      channelType: string;
      enabled: boolean;
      context?: { reason?: string };
    },
    context: PlanContext,
  ) {
    const payload = {
      botId: body.botId,
      channelType: body.channelType,
      enabled: body.enabled,
    };

    return this.planAction(`action tenant_bot_channel_toggle ${JSON.stringify(payload)}`, context);
  }

  async planTenantBotChannelConfigUpdate(
    body: {
      botId: string;
      channelType: string;
      config: Record<string, unknown>;
      context?: { reason?: string };
    },
    context: PlanContext,
  ) {
    const payload = {
      botId: body.botId,
      channelType: body.channelType,
      config: this.isPlainObject(body.config) ? body.config : {},
    };

    return this.planAction(
      `action tenant_bot_channel_config_update ${JSON.stringify(payload)}`,
      context,
    );
  }

  async planTenantAssistantConfigUpdate(
    body: {
      prompt?: string;
      welcomeMessage?: string;
      scopeNotes?: string;
      context?: { reason?: string };
    },
    context: PlanContext,
  ) {
    const assistantConfig: Record<string, unknown> = {};
    if (typeof body.prompt === 'string') {
      assistantConfig.prompt = body.prompt;
    }
    if (typeof body.welcomeMessage === 'string') {
      assistantConfig.welcomeMessage = body.welcomeMessage;
    }
    if (typeof body.scopeNotes === 'string') {
      assistantConfig.scopeNotes = body.scopeNotes;
    }

    return this.planAction(
      `action tenant_assistant_config_update ${JSON.stringify({ assistantConfig })}`,
      context,
    );
  }

  async planTenantKbBindingUpdate(
    body: {
      botId: string;
      knowledgeBaseId: string;
      context?: { reason?: string };
    },
    context: PlanContext,
  ) {
    const payload = {
      botId: body.botId,
      knowledgeBaseIds: [body.knowledgeBaseId],
    };

    return this.planAction(`action tenant_kb_binding_update ${JSON.stringify(payload)}`, context);
  }

  async confirmTenantAction(
    body: {
      actionId: string;
      confirmationCode: string;
      confirmationPhrase: string;
    },
    context: PlanContext,
  ) {
    if ((body.confirmationPhrase || '').trim() !== 'CONFIRM_TENANT_ACTION') {
      this.throwBadRequest(
        'CONFIRMATION_PHRASE_INVALID',
        'confirmationPhrase must be CONFIRM_TENANT_ACTION',
      );
    }

    return this.confirmAction(body.actionId, {
      ...context,
      confirmationToken: (body.confirmationCode || '').trim().toUpperCase(),
    });
  }

  async confirmAction(actionId: string, context: ConfirmContext) {
    const { tenantSchema, user } = context;
    const confirmationToken = (context.confirmationToken || '').trim().toUpperCase();

    this.assertTenantSchema(tenantSchema);
    this.assertUser(user);
    await this.ensureActionTables();

    if (!/^[0-9a-fA-F-]{36}$/.test(actionId)) {
      this.throwBadRequest('ACTION_ID_INVALID', 'actionId is invalid');
    }

    const rows = await this.dataSource.query(
      `SELECT id, tenant_schema, user_id, action_type, phase, scope, risk_level, payload, status, expires_at, token_expires_at, confirmation_token_hash, confirmation_attempts, created_at
       FROM assistant_action_pending
       WHERE id = $1 AND tenant_schema = $2 AND user_id = $3
       LIMIT 1`,
      [actionId, tenantSchema, user.sub],
    );

    const pending = rows?.[0] as PendingActionRow | undefined;
    if (!pending) {
      throw new NotFoundException('Pending action not found');
    }

    const policy = this.assertAllowed(pending.action_type, user);
    let auditWritten = false;

    try {
      if (pending.status !== 'pending') {
        this.throwBadRequest('ACTION_REPLAY_BLOCKED', 'Pending action is already processed');
      }

      const now = Date.now();
      const actionExpired = new Date(pending.expires_at).getTime() < now;
      const tokenExpired = pending.token_expires_at
        ? new Date(pending.token_expires_at).getTime() < now
        : false;

      if (actionExpired || tokenExpired) {
        await this.dataSource.query(
          `UPDATE assistant_action_pending SET status = 'expired' WHERE id = $1`,
          [actionId],
        );
        this.throwBadRequest('CONFIRMATION_EXPIRED', 'Pending action is expired');
      }

      const requiresConfirmationToken = this.requiresConfirmationToken(pending.action_type);
      if (requiresConfirmationToken && !confirmationToken) {
        await this.incrementConfirmationAttempt(actionId);
        this.throwForbidden(
          'CONFIRMATION_TOKEN_REQUIRED',
          'confirmationToken is required for this high-risk action',
        );
      }

      const confirmationTokenHash = confirmationToken
        ? this.hashConfirmationToken(confirmationToken)
        : null;

      if (
        requiresConfirmationToken &&
        confirmationTokenHash !== (pending.confirmation_token_hash || null)
      ) {
        await this.incrementConfirmationAttempt(actionId);
        this.throwForbidden('CONFIRMATION_TOKEN_INVALID', 'confirmationToken is invalid');
      }

      const claimRows = await this.dataSource.query(
        `UPDATE assistant_action_pending
         SET status = 'processing', confirmed_at = NOW()
         WHERE id = $1
           AND tenant_schema = $2
           AND user_id = $3
           AND status = 'pending'
           AND ($4::text IS NULL OR confirmation_token_hash = $4)
         RETURNING id`,
        [actionId, tenantSchema, user.sub, confirmationTokenHash],
      );

      if (!claimRows?.length) {
        this.throwBadRequest(
          'ACTION_REPLAY_BLOCKED',
          'Pending action is being processed or already consumed',
        );
      }

      try {
        const result = await this.executeAction({
          tenantSchema,
          user,
          actionType: pending.action_type,
          payload: (pending.payload || {}) as Record<string, unknown>,
          confirmedExecution: true,
        });

        await this.dataSource.query(
          `UPDATE assistant_action_pending
           SET status = 'confirmed', confirmation_token_hash = NULL
           WHERE id = $1`,
          [actionId],
        );

        await this.writeAuditLog({
          tenantSchema,
          userId: user.sub,
          actionType: pending.action_type,
          phase: pending.phase || policy.phase,
          scope: pending.scope || policy.scope,
          riskLevel: pending.risk_level || policy.riskLevel,
          payload: (pending.payload || {}) as Record<string, unknown>,
          status: 'confirmed',
          classification: 'success',
          result,
          metadata: {
            actionId,
            requiresConfirmationToken,
          },
        });
        auditWritten = true;

        return {
          success: true,
          actionId,
          actionType: pending.action_type,
          result,
        };
      } catch (error) {
        await this.dataSource.query(
          `UPDATE assistant_action_pending
           SET status = 'failed', confirmation_token_hash = NULL
           WHERE id = $1`,
          [actionId],
        );

        throw error;
      }
    } catch (error) {
      if (!auditWritten) {
        const securityError = this.classifyError(error);
        await this.safeWriteAuditLog({
          tenantSchema,
          userId: user.sub,
          actionType: pending.action_type,
          phase: pending.phase || policy.phase,
          scope: pending.scope || policy.scope,
          riskLevel: pending.risk_level || policy.riskLevel,
          payload: (pending.payload || {}) as Record<string, unknown>,
          status: securityError.status,
          classification: securityError.classification,
          errorCode: securityError.errorCode,
          errorMessage: securityError.errorMessage,
          metadata: {
            actionId,
            stage: 'confirm',
          },
        });
      }

      throw error;
    }
  }

  async getHistory(tenantSchema: string, user: AuthUser) {
    this.assertTenantSchema(tenantSchema);
    this.assertUser(user);
    await this.ensureActionTables();

    const rows = await this.dataSource.query(
      `SELECT id, action_type, phase, scope, risk_level, request_message, payload, status, classification, error_code, result, error_message, created_at
       FROM assistant_action_audit_logs
       WHERE tenant_schema = $1 AND user_id = $2
       ORDER BY created_at DESC
       LIMIT 100`,
      [tenantSchema, user.sub],
    );

    return rows.map((row: Record<string, unknown>) => {
      const normalizedPayload = this.normalizeObjectValue(row.payload);
      const normalizedResult = this.normalizeJsonValue(row.result);

      return {
        ...row,
        payload: this.maskSensitiveData(normalizedPayload),
        result: this.maskSensitiveData(normalizedResult),
      };
    });
  }
}
