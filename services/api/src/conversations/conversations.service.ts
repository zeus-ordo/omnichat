import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateConversationDto, ConversationQueryDto, SendMessageDto } from './dto/conversations.dto';
import { MessagesService } from '../messages/messages.service';
import { AiService } from '../ai/ai.service';
import { SurveysService } from '../surveys/surveys.service';

@Injectable()
export class ConversationsService {
  constructor(
    private dataSource: DataSource,
    private messagesService: MessagesService,
    private aiService: AiService,
    private surveysService: SurveysService,
  ) {}

  async createConversation(
    createDto: CreateConversationDto,
    tenantSchema: string,
    tenantSettings: any,
  ) {
    const { channel = 'web', channel_user_id, metadata = {} } = createDto;

    const result = await this.dataSource.query(
      `INSERT INTO ${tenantSchema}.conversations (channel, channel_user_id, metadata, status)
       VALUES ($1, $2, $3, 'active')
       RETURNING *`,
      [channel, channel_user_id, JSON.stringify(metadata)],
    );

    return result[0];
  }

  async getConversations(
    query: ConversationQueryDto,
    tenantSchema: string,
  ) {
    const { page = 1, limit = 20, status, channel, assigned_agent_id } = query;
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (channel) {
      whereClause += ` AND channel = $${paramIndex}`;
      params.push(channel);
      paramIndex++;
    }

    if (assigned_agent_id) {
      whereClause += ` AND assigned_agent_id = $${paramIndex}`;
      params.push(assigned_agent_id);
      paramIndex++;
    if (assigned_agent_id) {
      whereClause += ` AND assigned_agent_id = $${paramIndex}`;
      params.push(assigned_agent_id);
      paramIndex++;
    }

    // Search by keyword in messages
    if (query.search) {
      whereClause += ` AND id IN (
        SELECT DISTINCT conversation_id FROM ${tenantSchema}.messages 
        WHERE content ILIKE $${paramIndex}
      )`;
      params.push(`%${query.search}%`);
      paramIndex++;
    }

    // Date range filter
    if (query.date_from) {
      whereClause += ` AND created_at >= $${paramIndex}`;
      params.push(query.date_from);
      paramIndex++;
    }

    if (query.date_to) {
      whereClause += ` AND created_at <= $${paramIndex}`;
      params.push(query.date_to);
      paramIndex++;
    }

    // Priority filter (if metadata->>'priority' exists)
    if (query.priority) {
      whereClause += ` AND (metadata->>'priority') = $${paramIndex}`;
      params.push(query.priority);
      paramIndex++;
    }

    const countResult = await this.dataSource.query(
      `SELECT COUNT(*) FROM ${tenantSchema}.conversations WHERE ${whereClause}`,
      params,
    );

    const total = parseInt(countResult[0].count);

    const result = await this.dataSource.query(
      `SELECT * FROM ${tenantSchema}.conversations 
       WHERE ${whereClause} 
       ORDER BY created_at DESC 
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset],
    );

    return {
      data: result,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getConversation(
    id: string,
    tenantSchema: string,
  ) {
    const result = await this.dataSource.query(
      `SELECT * FROM ${tenantSchema}.conversations WHERE id = $1`,
      [id],
    );

    if (!result || result.length === 0) {
      throw new NotFoundException('Conversation not found');
    }

    return result[0];
  }

  async sendMessage(
    conversationId: string,
    sendDto: SendMessageDto,
    tenantSchema: string,
    tenantSettings: any,
  ) {
    const { content, model, temperature } = sendDto;

    // Get conversation
    const conversation = await this.getConversation(conversationId, tenantSchema);

    // Save user message
    const userMessage = await this.messagesService.createMessage(
      tenantSchema,
      conversationId,
      'user',
      content,
      {},
    );

    // Get conversation history
    const history = await this.messagesService.getConversationMessages(
      tenantSchema,
      conversationId,
    );

    // Check if any survey should be triggered
    const triggeredSurvey = await this.surveysService.checkAndTriggerSurvey(
      content,
      tenantSchema,
    );

    let aiResponse: any;
    let assistantMessage: any;

    if (triggeredSurvey) {
      // Send survey instead of AI response
      const surveyContent = this.formatSurveyMessage(triggeredSurvey);
      aiResponse = {
        content: surveyContent,
        tokens_used: 0,
        model: 'survey',
      };

      // Save survey message
      assistantMessage = await this.messagesService.createMessage(
        tenantSchema,
        conversationId,
        'assistant',
        surveyContent,
        { survey_id: triggeredSurvey.id, survey_title: triggeredSurvey.title, questions: triggeredSurvey.questions },
        0,
        'survey',
      );
    } else {
      // Call AI service
      aiResponse = await this.aiService.chat(
        content,
        history,
        tenantSettings,
        {
          model,
          temperature,
        },
      );

      // Save AI response
      assistantMessage = await this.messagesService.createMessage(
        tenantSchema,
        conversationId,
        'assistant',
        aiResponse.content,
        {},
        aiResponse.tokens_used,
        aiResponse.model,
      );
    }

    // Update conversation timestamp
    await this.dataSource.query(
      `UPDATE ${tenantSchema}.conversations SET updated_at = NOW() WHERE id = $1`,
      [conversationId],
    );

    return {
      message: assistantMessage,
      conversation,
      survey: triggeredSurvey || null,
      usage: {
        tokens: aiResponse.tokens_used,
        model: aiResponse.model,
      },
    };
  }

  private formatSurveyMessage(survey: any): string {
    const questions = survey.questions || [];
    let message = `📋 **${survey.title}**\n\n`;
    
    if (survey.description) {
      message += `${survey.description}\n\n`;
    }

    message += `請回答以下問題：\n\n`;

    questions.forEach((q: any, index: number) => {
      message += `${index + 1}. ${q.question}`;
      if (q.type === 'choice' && q.options) {
        message += `\n   選項：${q.options.join(', ')}`;
      }
      message += '\n\n';
    });

    message += `請輸入問題編號和你的答案（例如：1. 我的答案）\n`;
    message += `或者輸入「跳过」結束問卷`;

    return message;
  }

  async closeConversation(
    id: string,
    tenantSchema: string,
  ) {
    const result = await this.dataSource.query(
      `UPDATE ${tenantSchema}.conversations 
       SET status = 'closed', updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [id],
    );

    if (!result || result.length === 0) {
      throw new NotFoundException('Conversation not found');
    }

    return result[0];
  }

  async assignAgent(
    conversationId: string,
    agentId: string,
    tenantSchema: string,
  ) {
    const result = await this.dataSource.query(
      `UPDATE ${tenantSchema}.conversations 
       SET assigned_agent_id = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [agentId, conversationId],
    );

    if (!result || result.length === 0) {
      throw new NotFoundException('Conversation not found');
    }

    return result[0];
  }
}
