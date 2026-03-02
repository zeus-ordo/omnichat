import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

@Injectable()
export class AiService {
  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {}

  async chat(
    userMessage: string,
    history: ChatMessage[],
    tenantSettings: any,
    options: ChatOptions = {},
  ): Promise<{
    content: string;
    tokens_used: number;
    model: string;
  }> {
    const aiEngineUrl = this.configService.get('AI_ENGINE_URL') || 'http://ai-engine:8000';
    
    const model = options.model || tenantSettings?.default_model || 'gpt-4o';
    const temperature = options.temperature ?? 0.7;

    try {
      const response = await this.httpService.axiosRef.post(`${aiEngineUrl}/api/chat`, {
        messages: [
          ...history,
          { role: 'user', content: userMessage },
        ],
        model,
        temperature,
        tenant_settings: tenantSettings,
      });

      return {
        content: response.data.message.content,
        tokens_used: response.data.usage?.total_tokens || 0,
        model: response.data.model || model,
      };
    } catch (error) {
      console.error('AI Engine error:', error.response?.data || error.message);
      throw new HttpException(
        error.response?.data?.message || 'AI service error',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async chatWithRag(
    userMessage: string,
    history: ChatMessage[],
    tenantSettings: any,
    options: ChatOptions = {},
  ): Promise<{
    content: string;
    tokens_used: number;
    model: string;
    sources?: any[];
  }> {
    const aiEngineUrl = this.configService.get('AI_ENGINE_URL') || 'http://ai-engine:8000';
    
    const model = options.model || tenantSettings?.default_model || 'gpt-4o';

    try {
      const response = await this.httpService.axiosRef.post(`${aiEngineUrl}/api/chat/rag`, {
        messages: [
          ...history,
          { role: 'user', content: userMessage },
        ],
        model,
        tenant_settings: tenantSettings,
        use_rag: true,
      });

      return {
        content: response.data.message.content,
        tokens_used: response.data.usage?.total_tokens || 0,
        model: response.data.model || model,
        sources: response.data.sources || [],
      };
    } catch (error) {
      console.error('AI Engine RAG error:', error.response?.data || error.message);
      throw new HttpException(
        error.response?.data?.message || 'AI RAG service error',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
