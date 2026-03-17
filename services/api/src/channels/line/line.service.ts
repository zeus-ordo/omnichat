import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { DataSource } from 'typeorm';

interface LineEvent {
  type: string;
  source: {
    type: string;
    userId: string;
    groupId?: string;
    roomId?: string;
  };
  timestamp: number;
  message: {
    type: string;
    id: string;
    text?: string;
  };
  replyToken?: string;
}

@Injectable()
export class LineService {
  private fallbackChannelAccessToken: string;
  private fallbackChannelSecret: string;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
    private dataSource: DataSource,
  ) {
    this.fallbackChannelAccessToken = this.configService.get('LINE_CHANNEL_ACCESS_TOKEN') || '';
    this.fallbackChannelSecret = this.configService.get('LINE_CHANNEL_SECRET') || '';
  }

  async resolveLineConfig(
    tenantSchema: string,
    botId?: string,
  ): Promise<{ channelAccessToken: string; channelSecret: string } | null> {
    const rows = await this.dataSource.query(
      `SELECT settings FROM tenants WHERE schema_name = $1 LIMIT 1`,
      [tenantSchema],
    );
    const settings = rows?.[0]?.settings || {};
    const bots = Array.isArray(settings?.website_bots) ? settings.website_bots : [];

    const lineEnabledBots = bots.filter((bot: any) =>
      Array.isArray(bot?.channels) &&
      bot.channels.some((channel: any) => channel?.type === 'line' && channel?.enabled),
    );

    const selectedBot = botId
      ? lineEnabledBots.find((bot: any) => bot?.id === botId)
      : lineEnabledBots[0];

    const token = selectedBot?.channelConfigs?.line?.channelAccessToken;
    const secret = selectedBot?.channelConfigs?.line?.channelSecret;

    if (token && secret) {
      return {
        channelAccessToken: String(token),
        channelSecret: String(secret),
      };
    }

    if (this.fallbackChannelAccessToken && this.fallbackChannelSecret) {
      return {
        channelAccessToken: this.fallbackChannelAccessToken,
        channelSecret: this.fallbackChannelSecret,
      };
    }

    return null;
  }

  async handleWebhook(body: any, channelAccessToken?: string) {
    const events: LineEvent[] = body.events || [];
    
    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        await this.handleTextMessage(event, channelAccessToken);
      }
    }

    return { success: true };
  }

  private async handleTextMessage(event: LineEvent, channelAccessToken?: string) {
    const userId = event.source.userId;
    const userMessage = event.message.text;
    const replyToken = event.replyToken;

    // Here you would:
    // 1. Find or create conversation for this user
    // 2. Call AI to get response
    // 3. Send reply back to LINE

    // For now, just echo back (placeholder)
    console.log(`LINE message from ${userId}: ${userMessage}`);
    
    if (replyToken) {
      await this.sendReply(replyToken, [`收到訊息：${userMessage}`], channelAccessToken);
    }
  }

  async sendReply(replyToken: string, messages: string[], channelAccessToken?: string) {
    const token = channelAccessToken || this.fallbackChannelAccessToken;
    if (!token) {
      console.warn('LINE channel access token not configured');
      return;
    }

    try {
      await this.httpService.axiosRef.post(
        'https://api.line.me/v2/bot/message/reply',
        {
          replyToken,
          messages: messages.map((text) => ({ type: 'text', text })),
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );
    } catch (error) {
      console.error('Failed to send LINE reply', error);
    }
  }

  async sendPushMessage(userId: string, messages: string[]) {
    if (!this.fallbackChannelAccessToken) {
      console.warn('LINE channel access token not configured');
      return;
    }

    try {
      await this.httpService.axiosRef.post(
        'https://api.line.me/v2/bot/message/push',
        {
          to: userId,
          messages: messages.map((text) => ({ type: 'text', text })),
        },
        {
          headers: {
            'Authorization': `Bearer ${this.fallbackChannelAccessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
    } catch (error) {
      console.error('Failed to send LINE push message', error);
    }
  }

  verifySignature(signature: string, body: string, channelSecret?: string): boolean {
    const secret = channelSecret || this.fallbackChannelSecret;
    if (!secret) {
      return false;
    }

    const crypto = require('crypto');
    const hash = crypto
      .createHmac('SHA256', secret)
      .update(body)
      .digest('base64');
    return hash === signature;
  }
}
