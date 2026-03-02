import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  businessAccountId: string;
  webhooksVerifyToken: string;
}

@Injectable()
export class WhatsAppService {
  constructor(private dataSource: DataSource) {}

  async configure(tenantSchema: string, config: WhatsAppConfig) {
    // Save WhatsApp configuration to tenant settings
    const currentSettings = await this.dataSource.query(
      `SELECT settings FROM tenants WHERE schema_name = $1`,
      [tenantSchema.replace('"', '')],
    );

    const settings = currentSettings[0]?.settings || {};
    settings.whatsapp = {
      ...config,
      enabled: true,
      configuredAt: new Date().toISOString(),
    };

    await this.dataSource.query(
      `UPDATE tenants SET settings = $1 WHERE schema_name = $2`,
      [JSON.stringify(settings), tenantSchema.replace('"', '')],
    );

    return { success: true, message: 'WhatsApp configured successfully' };
  }

  async getConfig(tenantSchema: string) {
    const result = await this.dataSource.query(
      `SELECT settings FROM tenants WHERE schema_name = $1`,
      [tenantSchema.replace('"', '')],
    );

    const settings = result[0]?.settings || {};
    const whatsapp = settings.whatsapp || {};

    // Return config without sensitive data
    return {
      enabled: whatsapp.enabled || false,
      phoneNumberId: whatsapp.phoneNumberId || '',
      businessAccountId: whatsapp.businessAccountId || '',
      configured: !!whatsapp.accessToken,
    };
  }

  async disable(tenantSchema: string) {
    const currentSettings = await this.dataSource.query(
      `SELECT settings FROM tenants WHERE schema_name = $1`,
      [tenantSchema.replace('"', '')],
    );

    const settings = currentSettings[0]?.settings || {};
    if (settings.whatsapp) {
      settings.whatsapp.enabled = false;
    }

    await this.dataSource.query(
      `UPDATE tenants SET settings = $1 WHERE schema_name = $2`,
      [JSON.stringify(settings), tenantSchema.replace('"', '')],
    );

    return { success: true, message: 'WhatsApp disabled' };
  }

  // Handle incoming WhatsApp webhooks
  async handleWebhook(payload: any, tenantSchema: string) {
    const { entry } = payload;

    if (!entry || !entry[0]?.changes) {
      return { received: true };
    }

    for (const change of entry[0].changes) {
      if (change.value?.messages) {
        for (const message of change.value.messages) {
          await this.processIncomingMessage(message, tenantSchema, change.value.metadata);
        }
      }
    }

    return { received: true };
  }

  private async processIncomingMessage(message: any, tenantSchema: string, metadata: any) {
    const from = message.from;
    const messageType = message.type;
    let content = '';

    switch (messageType) {
      case 'text':
        content = message.text?.body || '';
        break;
      case 'image':
        content = '[Image]';
        break;
      case 'audio':
        content = '[Audio]';
        break;
      case 'video':
        content = '[Video]';
        break;
      case 'document':
        content = `[Document: ${message.document?.filename || 'file'}]`;
        break;
      case 'location':
        content = '[Location]';
        break;
      default:
        content = `[${messageType}]`;
    }

    // Find or create conversation
    const existingConv = await this.dataSource.query(
      `SELECT id FROM ${tenantSchema}.conversations 
       WHERE channel = 'whatsapp' AND channel_user_id = $1 
       AND status = 'active' 
       ORDER BY created_at DESC LIMIT 1`,
      [from],
    );

    let conversationId;
    if (existingConv.length > 0) {
      conversationId = existingConv[0].id;
    } else {
      const newConv = await this.dataSource.query(
        `INSERT INTO ${tenantSchema}.conversations (channel, channel_user_id, status, metadata)
         VALUES ('whatsapp', $1, 'active', $2)
         RETURNING id`,
        [from, JSON.stringify({ phone_number_id: metadata?.phone_number_id })],
      );
      conversationId = newConv[0].id;
    }

    // Save message
    await this.dataSource.query(
      `INSERT INTO ${tenantSchema}.messages (conversation_id, role, content, metadata)
       VALUES ($1, 'user', $2, $3)`,
      [conversationId, content, JSON.stringify({ whatsapp_message_id: message.id, timestamp: message.timestamp })],
    );

    return { conversationId };
  }

  // Send message via WhatsApp API
  async sendMessage(to: string, content: string, tenantSchema: string) {
    // Get WhatsApp config from settings
    const result = await this.dataSource.query(
      `SELECT settings FROM tenants WHERE schema_name = $1`,
      [tenantSchema.replace('"', '')],
    );

    const settings = result[0]?.settings || {};
    const whatsappConfig = settings.whatsapp;

    if (!whatsappConfig?.enabled || !whatsappConfig?.accessToken) {
      throw new BadRequestException('WhatsApp is not configured');
    }

    // In production, this would call the actual WhatsApp Business API
    // For now, return the payload that would be sent
    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: content },
    };

    // Simulated API call
    console.log('WhatsApp API Payload:', JSON.stringify(payload, null, 2));

    return {
      success: true,
      message: 'Message queued for sending',
      payload,
    };
  }

  // Verify webhook
  verifyWebhook(mode: string, token: string, challenge: string, tenantSchema: string) {
    // In production, verify against configured verify token
    if (mode === 'subscribe' && token) {
      return challenge;
    }
    return null;
  }
}
