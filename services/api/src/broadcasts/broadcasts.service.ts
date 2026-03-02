import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateBroadcastDto, BroadcastQueryDto } from './dto/broadcasts.dto';

@Injectable()
export class BroadcastsService {
  constructor(private dataSource: DataSource) {}

  async create(createDto: CreateBroadcastDto, tenantSchema: string, userId: string) {
    const { subject, content, channel, scheduled_at } = createDto;

    const result = await this.dataSource.query(
      `INSERT INTO ${tenantSchema}.broadcasts 
       (subject, content, channel, status, scheduled_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [subject, content, channel || 'all', scheduled_at ? new Date(scheduled_at) : null, scheduled_at ? 'scheduled' : 'draft', userId],
    );

    return result[0];
  }

  async findAll(query: BroadcastQueryDto, tenantSchema: string) {
    const { page = 1, limit = 20, status } = query;
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const countResult = await this.dataSource.query(
      `SELECT COUNT(*) FROM ${tenantSchema}.broadcasts WHERE ${whereClause}`,
      params,
    );

    const total = parseInt(countResult[0].count);

    const result = await this.dataSource.query(
      `SELECT * FROM ${tenantSchema}.broadcasts 
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

  async findOne(id: string, tenantSchema: string) {
    const result = await this.dataSource.query(
      `SELECT * FROM ${tenantSchema}.broadcasts WHERE id = $1`,
      [id],
    );

    if (!result || result.length === 0) {
      throw new NotFoundException('Broadcast not found');
    }

    return result[0];
  }

  async send(id: string, tenantSchema: string) {
    // Get the broadcast
    const broadcast = await this.findOne(id, tenantSchema);

    if (broadcast.status === 'sent') {
      throw new Error('Broadcast already sent');
    }

    // Get all active conversations for the channel
    const channelFilter = broadcast.channel === 'all' ? '' : `AND channel = '${broadcast.channel}'`;
    
    const conversations = await this.dataSource.query(
      `SELECT id FROM ${tenantSchema}.conversations WHERE status = 'active' ${channelFilter}`,
    );

    // For each conversation, create a message (simulated - in real app would send to actual channel)
    let sentCount = 0;
    for (const conv of conversations) {
      try {
        await this.dataSource.query(
          `INSERT INTO ${tenantSchema}.messages (conversation_id, role, content, metadata)
           VALUES ($1, 'assistant', $2, $3)`,
          [conv.id, broadcast.content, { broadcast_id: id, broadcast_subject: broadcast.subject }],
        );
        sentCount++;
      } catch (error) {
        console.error(`Failed to send to conversation ${conv.id}`, error);
      }
    }

    // Update broadcast status
    await this.dataSource.query(
      `UPDATE ${tenantSchema}.broadcasts 
       SET status = 'sent', sent_at = NOW(), recipient_count = $1 
       WHERE id = $2`,
      [sentCount, id],
    );

    return { sent_count: sentCount, total_conversations: conversations.length };
  }

  async cancel(id: string, tenantSchema: string) {
    const broadcast = await this.findOne(id, tenantSchema);

    if (broadcast.status === 'sent') {
      throw new Error('Cannot cancel a sent broadcast');
    }

    const result = await this.dataSource.query(
      `UPDATE ${tenantSchema}.broadcasts 
       SET status = 'cancelled', updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [id],
    );

    return result[0];
  }

  async remove(id: string, tenantSchema: string) {
    const result = await this.dataSource.query(
      `DELETE FROM ${tenantSchema}.broadcasts WHERE id = $1 RETURNING *`,
      [id],
    );

    if (!result || result.length === 0) {
      throw new NotFoundException('Broadcast not found');
    }

    return result[0];
  }
}
