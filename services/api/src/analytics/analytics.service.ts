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


  // Advanced Analytics
  async getHourlyStats(tenantSchema: string, days: number = 7) {
    return this.dataSource.query(
      `SELECT 
        DATE(created_at) as date,
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as messages
       FROM ${tenantSchema}.messages
       WHERE created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE(created_at), EXTRACT(HOUR FROM created_at)
       ORDER BY date, hour`,
    );
  }

  async getAiPerformance(tenantSchema: string, days: number = 30) {
    const result = await this.dataSource.query(
      `SELECT 
        model_used,
        COUNT(*) as total_responses,
        COALESCE(SUM(tokens_used), 0) as total_tokens,
        ROUND(AVG(tokens_used), 2) as avg_tokens,
        COUNT(DISTINCT conversation_id) as unique_conversations
       FROM ${tenantSchema}.messages 
       WHERE role = 'assistant' 
         AND model_used IS NOT NULL
         AND created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY model_used`,
    );
    return result;
  }

  async getConversationMetrics(tenantSchema: string, days: number = 30) {
    const result = await this.dataSource.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed,
        COUNT(CASE WHEN status = 'archived' THEN 1 END) as archived,
        COUNT(CASE WHEN assigned_agent_id IS NOT NULL THEN 1 END) as assigned,
        COUNT(CASE WHEN assigned_agent_id IS NULL THEN 1 END) as unassigned
       FROM ${tenantSchema}.conversations
       WHERE created_at >= NOW() - INTERVAL '${days} days'`,
    );
    return result[0];
  }

  async getResponseTimeStats(tenantSchema: string, days: number = 30) {
    // Average response time calculation (first user message to first AI response)
    const result = await this.dataSource.query(
      `WITH conversation_times AS (
        SELECT 
          c.id,
          c.created_at as conversation_start,
          MIN(m1.created_at) as first_user_message,
          MIN(m2.created_at) as first_ai_response,
          EXTRACT(EPOCH FROM (MIN(m2.created_at) - MIN(m1.created_at))) as response_time_seconds
        FROM ${tenantSchema}.conversations c
        LEFT JOIN ${tenantSchema}.messages m1 ON c.id = m1.conversation_id AND m1.role = 'user'
        LEFT JOIN ${tenantSchema}.messages m2 ON c.id = m2.conversation_id AND m2.role = 'assistant'
        WHERE c.created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY c.id
      )
      SELECT 
        ROUND(AVG(response_time_seconds), 2) as avg_response_time,
        ROUND(MIN(response_time_seconds), 2) as min_response_time,
        ROUND(MAX(response_time_seconds), 2) as max_response_time,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY response_time_seconds), 2) as median_response_time,
        COUNT(*) as total_conversations
      FROM conversation_times
      WHERE response_time_seconds > 0`,
    );
    return result[0];
  }

  async getChannelComparison(tenantSchema: string, days: number = 30) {
    return this.dataSource.query(
      `SELECT 
        c.channel,
        COUNT(DISTINCT c.id) as total_conversations,
        COUNT(m.id) as total_messages,
        ROUND(AVG(m.tokens_used), 2) as avg_tokens_per_conversation,
        COUNT(DISTINCT c.assigned_agent_id) as agents_assigned
       FROM ${tenantSchema}.conversations c
       LEFT JOIN ${tenantSchema}.messages m ON c.id = m.conversation_id
       WHERE c.created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY c.channel`,
    );
  }

  async getCustomerSatisfaction(tenantSchema: string) {
    // This would typically come from survey responses
    const result = await this.dataSource.query(
      `SELECT 
        sr.survey_id,
        s.title,
        COUNT(sr.id) as total_responses,
        COUNT(CASE WHEN (sr.answers::jsonb) ->> 'rating' = '5' THEN 1 END) as happy,
        COUNT(CASE WHEN (sr.answers::jsonb) ->> 'rating' IN ('1', '2', '3') THEN 1 END) as unhappy
       FROM ${tenantSchema}.survey_responses sr
       JOIN ${tenantSchema}.surveys s ON sr.survey_id = s.id
       GROUP BY sr.survey_id, s.title`,
    );
    return result;
  }

  async getAgentPerformance(tenantSchema: string, days: number = 30) {
    return this.dataSource.query(
      `SELECT 
        u.id,
        u.name,
        u.email,
        COUNT(DISTINCT c.id) as assigned_conversations,
        COUNT(c CASE WHEN c.status = 'closed' THEN 1 END) as resolved_conversations,
        ROUND(COUNT(c CASE WHEN c.status = 'closed' END) * 100.0 / NULLIF(COUNT(c), 0), 2) as resolution_rate,
        MAX(c.updated_at) as last_activity
       FROM ${tenantSchema}.users u
       LEFT JOIN ${tenantSchema}.conversations c ON u.id = c.assigned_agent_id 
         AND c.created_at >= NOW() - INTERVAL '${days} days'
       WHERE u.role IN ('agent', 'admin', 'owner')
       GROUP BY u.id, u.name, u.email`,
    );
  }

  async getMessageTrends(tenantSchema: string, days: number = 30) {
    return this.dataSource.query(
      `SELECT 
        DATE(created_at) as date,
        role,
        COUNT(*) as count
       FROM ${tenantSchema}.messages
       WHERE created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE(created_at), role
       ORDER BY date`,
    );
  }

  async getPopularTopics(tenantSchema: string, limit: number = 10) {
    // Simple keyword extraction from user messages
    return this.dataSource.query(
      `SELECT 
        LOWER(word) as keyword,
        COUNT(*) as frequency
       FROM ${tenantSchema}.messages,
         LATERAL REGEXP_SPLIT_TO_TABLE(content, '\s+')
       WHERE role = 'user' 
         AND LENGTH(word) > 3
         AND word NOT IN ('this', 'that', 'have', 'with', 'from', 'what', 'your', 'need', 'want', 'help')
       GROUP BY LOWER(word)
       ORDER BY frequency DESC
       LIMIT $1`,
      [limit],
    );
  }
}
