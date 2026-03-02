import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AnalyticsService {
  constructor(private dataSource: DataSource) {}

  async getOverview(tenantSchema: string) {
    const totalConversations = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM ${tenantSchema}.conversations`,
    );
    
    const activeConversations = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM ${tenantSchema}.conversations WHERE status = 'active'`,
    );

    const totalMessages = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM ${tenantSchema}.messages`,
    );

    const totalTokens = await this.dataSource.query(
      `SELECT COALESCE(SUM(tokens_used), 0) as total FROM ${tenantSchema}.messages WHERE role = 'assistant'`,
    );

    return {
      total_conversations: parseInt(totalConversations[0]?.count || 0),
      active_conversations: parseInt(activeConversations[0]?.count || 0),
      total_messages: parseInt(totalMessages[0]?.count || 0),
      total_tokens: parseInt(totalTokens[0]?.total || 0),
    };
  }

  async getConversationsByChannel(tenantSchema: string) {
    return this.dataSource.query(
      `SELECT channel, COUNT(*) as count 
       FROM ${tenantSchema}.conversations 
       GROUP BY channel`,
    );
  }

  async getDailyStats(tenantSchema: string, days: number = 30) {
    return this.dataSource.query(
      `SELECT DATE(created_at) as date, COUNT(*) as conversations
       FROM ${tenantSchema}.conversations
       WHERE created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE(created_at)
       ORDER BY date`,
    );
  }
}
