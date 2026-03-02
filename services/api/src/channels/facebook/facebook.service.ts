import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';

interface FBMessaging {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message: {
    mid: string;
    seq: number;
    text?: string;
    attachments?: any[];
  };
}

@Injectable()
export class FacebookService {
  private pageAccessToken: string;
  private pageId: string;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.pageAccessToken = this.configService.get('FACEBOOK_PAGE_ACCESS_TOKEN') || '';
    this.pageId = this.configService.get('FACEBOOK_PAGE_ID') || '';
  }

  async handleWebhook(body: any) {
    const { object, entry } = body;

    if (object !== 'page') {
      return { success: false, error: 'Not a page object' };
    }

    for (const pageEntry of entry) {
      const messaging: FBMessaging[] = pageEntry.messaging || [];
      
      for (const message of messaging) {
        if (message.message && message.message.text) {
          await this.handleMessage(message);
        }
      }
    }

    return { success: true };
  }

  private async handleMessage(messaging: FBMessaging) {
    const senderId = messaging.sender.id;
    const userMessage = messaging.message.text;

    console.log(`Facebook message from ${senderId}: ${userMessage}`);
    
    // Here you would:
    // 1. Find or create conversation
    // 2. Call AI
    // 3. Send reply
  }

  async sendMessage(recipientId: string, message: string) {
    if (!this.pageAccessToken) {
      console.warn('Facebook page access token not configured');
      return;
    }

    try {
      await this.httpService.axiosRef.post(
        'https://graph.facebook.com/v18.0/me/messages',
        {
          recipient: { id: recipientId },
          message: { text: message },
        },
        {
          params: { access_token: this.pageAccessToken },
        },
      );
    } catch (error) {
      console.error('Failed to send Facebook message', error);
    }
  }

  async verifyWebhook(mode: string, token: string, challenge: string) {
    // Facebook verification
    if (mode === 'subscribe' && token === this.pageAccessToken) {
      return challenge;
    }
    return false;
  }
}
