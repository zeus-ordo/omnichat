import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';

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
  private channelAccessToken: string;
  private channelSecret: string;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.channelAccessToken = this.configService.get('LINE_CHANNEL_ACCESS_TOKEN') || '';
    this.channelSecret = this.configService.get('LINE_CHANNEL_SECRET') || '';
  }

  async handleWebhook(body: any) {
    const events: LineEvent[] = body.events || [];
    
    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        await this.handleTextMessage(event);
      }
    }

    return { success: true };
  }

  private async handleTextMessage(event: LineEvent) {
    const userId = event.source.userId;
    const userMessage = event.message.text;
    const replyToken = event.replyToken;

    // Here you would:
    // 1. Find or create conversation for this user
    // 2. Call AI to get response
    // 3. Send reply back to LINE

    // For now, just echo back (placeholder)
    console.log(`LINE message from ${userId}: ${userMessage}`);
    
    // Example reply:
    // await this.sendReply(replyToken, 'AI response here');
  }

  async sendReply(replyToken: string, messages: string[]) {
    if (!this.channelAccessToken) {
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
            'Authorization': `Bearer ${this.channelAccessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
    } catch (error) {
      console.error('Failed to send LINE reply', error);
    }
  }

  async sendPushMessage(userId: string, messages: string[]) {
    if (!this.channelAccessToken) {
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
            'Authorization': `Bearer ${this.channelAccessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
    } catch (error) {
      console.error('Failed to send LINE push message', error);
    }
  }

  verifySignature(signature: string, body: string): boolean {
    // Implement LINE signature verification
    const crypto = require('crypto');
    const hash = crypto
      .createHmac('SHA256', this.channelSecret)
      .update(body)
      .digest('base64');
    return hash === signature;
  }
}
