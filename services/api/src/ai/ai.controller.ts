import {
  Controller,
  Post,
  Put,
  Get,
  Body,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { AiService } from './ai.service';
import { SurveysService } from '../surveys/surveys.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AssistantHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

interface AssistantConfig {
  prompt: string;
  welcomeMessage: string;
  scopeNotes: string;
}

interface AssistantConfigPayload {
  prompt?: string;
  welcomeMessage?: string;
  scopeNotes?: string;
}

@ApiTags('AI')
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly dataSource: DataSource,
    private readonly surveysService: SurveysService,
  ) {}

  private getDefaultAssistantConfig(): AssistantConfig {
    return {
      prompt:
        '你是 OmniChat 的網站使用導覽助理。你的任務是引導已登入使用者快速學會使用網站功能。回答要簡潔、步驟化、可執行，預設使用繁體中文。若使用者提到頁面名稱（Dashboard、Bots、Channels、Knowledge Base、Conversations、Analytics、Settings），請給對應操作步驟。若資訊不足，先問一個最小必要問題再繼續。',
      welcomeMessage:
        '嗨，我是系統小助手。你可以問我「怎麼建立機器人」、「怎麼串接 LINE」、「怎麼看報表」等操作問題。',
      scopeNotes:
        '重點功能：Dashboard、Bots、Channels、Knowledge Base、Conversations、Analytics、Settings。',
    };
  }

  private resolveAssistantConfig(tenantSettings: any): AssistantConfig {
    const defaults = this.getDefaultAssistantConfig();
    const settings = tenantSettings || {};
    const stored = settings.website_assistant || {};

    return {
      prompt: (stored.prompt || defaults.prompt).toString(),
      welcomeMessage: (stored.welcomeMessage || defaults.welcomeMessage).toString(),
      scopeNotes: (stored.scopeNotes || defaults.scopeNotes).toString(),
    };
  }

  private sanitizeAssistantContent(raw: string): string {
    const content = (raw || '').toString();

    if (!content.trim()) {
      return '目前無法取得回覆，請稍後再試。';
    }

    const withoutCodeBlocks = content.replace(/```[\s\S]*?```/g, '').trim();
    const looksLikeCode = /function\s*\(|const\s+\w+\s*=|class\s+\w+|<\/?\w+>|import\s+\w+\s+from|\{\s*\n/.test(content);

    if (looksLikeCode && withoutCodeBlocks.length < 40) {
      return '我可以用步驟方式帶你操作，不會貼程式碼。請告訴我你要完成的目標（例如：建立機器人、串接 LINE、查看分析報表）。';
    }

    return withoutCodeBlocks || content;
  }

  @Get('assistant/config')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get website assistant config for current tenant' })
  getAssistantConfig(@Req() req: Request) {
    const tenantSettings = (req as any).tenantSettings || {};
    return this.resolveAssistantConfig(tenantSettings);
  }

  @Put('assistant/config')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update website assistant config (admin/owner only)' })
  async updateAssistantConfig(
    @Body() payload: AssistantConfigPayload,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    if (!user || !['owner', 'admin'].includes(user.role)) {
      throw new ForbiddenException('Only admin/owner can update assistant config');
    }

    const tenantSchema = (req as any).tenantSchema;
    const tenantSettings = (req as any).tenantSettings || {};
    const current = this.resolveAssistantConfig(tenantSettings);

    const next: AssistantConfig = {
      prompt: payload.prompt?.trim() || current.prompt,
      welcomeMessage: payload.welcomeMessage?.trim() || current.welcomeMessage,
      scopeNotes: payload.scopeNotes?.trim() || current.scopeNotes,
    };

    await this.dataSource.query(
      `UPDATE tenants
       SET settings = COALESCE(settings, '{}'::jsonb)
                     || jsonb_build_object('website_assistant', $1::jsonb, 'system_prompt', $2)
       WHERE schema_name = $3`,
      [JSON.stringify(next), next.prompt, tenantSchema],
    );

    return {
      success: true,
      config: next,
    };
  }

  @Post('assistant/chat')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chat with website guide assistant (authenticated)' })
  async assistantChat(
    @Body() body: { message: string; history?: AssistantHistoryItem[] },
    @Req() req: Request,
  ) {
    const tenantSettings = (req as any).tenantSettings || {};
    const assistantConfig = this.resolveAssistantConfig(tenantSettings);

    const safeHistory = Array.isArray(body.history)
      ? body.history
          .filter((item) => item && ['user', 'assistant'].includes(item.role) && item.content)
          .slice(-12)
      : [];

    try {
      const aiResponse = await this.aiService.chat(
        body.message,
        safeHistory,
        {
          ...tenantSettings,
          system_prompt: `${assistantConfig.prompt}\n\n導覽範圍補充：${assistantConfig.scopeNotes}\n\n重要規則：只提供網站操作步驟與說明，不要輸出程式碼、JSON、SQL、設定檔片段。`,
        },
        { temperature: 0.2, max_tokens: 500, timeout_ms: 20000 },
      );

      return {
        content: this.sanitizeAssistantContent(aiResponse.content),
        model: aiResponse.model,
        tokens_used: aiResponse.tokens_used,
      };
    } catch {
      return {
        content:
          '目前小助手暫時無法連線到 AI 服務。請稍後再試，或通知管理員檢查 OpenAI API Key 設定。',
        model: 'fallback',
        tokens_used: 0,
      };
    }
  }

  @Post('chat')
  @UseGuards()
  @ApiOperation({ summary: 'Chat with AI (public endpoint for widget)' })
  async chat(
    @Body() body: { message: string; conversation_id?: string; model?: string },
    @Req() req: Request,
  ) {
    const tenantSchema = (req as any).tenantSchema;
    const tenantSettings = (req as any).tenantSettings || {};
    const { message, conversation_id, model } = body;

    try {
      // Create or get conversation
      let conversation;
      if (conversation_id) {
        const result = await this.dataSource.query(
          `SELECT * FROM ${tenantSchema}.conversations WHERE id = $1`,
          [conversation_id],
        );
        conversation = result[0];
      }

      if (!conversation) {
        // Create new conversation
        const newConv = await this.dataSource.query(
          `INSERT INTO ${tenantSchema}.conversations (channel, status) 
           VALUES ('web', 'active') RETURNING *`,
        );
        conversation = newConv[0];
      }

      // Save user message
      await this.dataSource.query(
        `INSERT INTO ${tenantSchema}.messages (conversation_id, role, content, metadata) 
         VALUES ($1, 'user', $2, '{}')`,
        [conversation.id, message],
      );

      // Check if survey should be triggered
      const triggeredSurvey = await this.surveysService.checkAndTriggerSurvey(
        message,
        tenantSchema,
      );

      let aiResponse: any;

      if (triggeredSurvey) {
        // Send survey instead of AI response
        const surveyContent = `📋 **${triggeredSurvey.title}**\n\nPlease answer the following questions:\n\n${triggeredSurvey.questions.map((q: any, i: number) => `${i + 1}. ${q.question}`).join('\n')}`;
        
        aiResponse = {
          content: surveyContent,
          tokens_used: 0,
          model: 'survey',
        };

        // Save survey message
        await this.dataSource.query(
          `INSERT INTO ${tenantSchema}.messages (conversation_id, role, content, metadata, tokens_used, model_used) 
           VALUES ($1, 'assistant', $2, $3, $4, $5)`,
          [conversation.id, surveyContent, { survey_id: triggeredSurvey.id, survey_title: triggeredSurvey.title }, 0, 'survey'],
        );
      } else {
        // Call AI service
        aiResponse = await this.aiService.chat(
          message,
          [],
          tenantSettings,
          { model },
        );

        // Save AI response
        await this.dataSource.query(
          `INSERT INTO ${tenantSchema}.messages (conversation_id, role, content, metadata, tokens_used, model_used) 
           VALUES ($1, 'assistant', $2, '{}', $3, $4)`,
          [conversation.id, aiResponse.content, aiResponse.tokens_used, aiResponse.model],
        );
      }

      // Return response with conversation_id
      // Return response with conversation_id
      return {
        ...aiResponse,
        conversation_id: conversation.id,
      };
    } catch (error) {
      console.error('Error in AI chat:', error);
      // Fallback to simple AI chat if conversation handling fails
      return this.aiService.chat(
        message,
        [],
        tenantSettings,
        { model },
      );
    }
  }
}
