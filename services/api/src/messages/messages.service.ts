import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class MessagesService {
  constructor(private dataSource: DataSource) {}

  async createMessage(
    tenantSchema: string,
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata: Record<string, any>,
    tokensUsed: number = 0,
    modelUsed?: string,
  ) {
    const result = await this.dataSource.query(
      `INSERT INTO ${tenantSchema}.messages 
       (conversation_id, role, content, metadata, tokens_used, model_used)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [conversationId, role, content, JSON.stringify(metadata), tokensUsed, modelUsed],
    );
    return result[0];
  }

  async getConversationMessages(
    tenantSchema: string,
    conversationId: string,
    limit: number = 50,
  ) {
    const result = await this.dataSource.query(
      `SELECT role, content, created_at FROM ${tenantSchema}.messages 
       WHERE conversation_id = $1 
       ORDER BY created_at ASC 
       LIMIT $2`,
      [conversationId, limit],
    );
    return result;
  }

  async getMessage(
    tenantSchema: string,
    messageId: string,
  ) {
    const result = await this.dataSource.query(
      `SELECT * FROM ${tenantSchema}.messages WHERE id = $1`,
      [messageId],
    );
    return result[0] || null;
  }
}
