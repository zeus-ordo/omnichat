import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { AiService } from './ai.service';
import { SurveysService } from '../surveys/surveys.service';

@ApiTags('AI')
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly dataSource: DataSource,
    private readonly surveysService: SurveysService,
  ) {}

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
