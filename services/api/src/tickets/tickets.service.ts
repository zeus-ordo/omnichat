import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateTicketDto, TicketQueryDto, UpdateTicketDto } from './dto/tickets.dto';

@Injectable()
export class TicketsService {
  constructor(private dataSource: DataSource) {}

  async create(createDto: CreateTicketDto, tenantSchema: string, userId: string) {
    const { subject, description, priority, conversation_id } = createDto;

    const result = await this.dataSource.query(
      `INSERT INTO ${tenantSchema}.tickets 
       (subject, description, priority, status, conversation_id, created_by)
       VALUES ($1, $2, $3, 'open', $4, $5)
       RETURNING *`,
      [subject, description, priority || 'medium', conversation_id, userId],
    );

    return result[0];
  }

  async findAll(query: TicketQueryDto, tenantSchema: string) {
    const { page = 1, limit = 20, status, priority, assigned_agent_id } = query;
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (priority) {
      whereClause += ` AND priority = $${paramIndex}`;
      params.push(priority);
      paramIndex++;
    }

    if (assigned_agent_id) {
      whereClause += ` AND assigned_agent_id = $${paramIndex}`;
      params.push(assigned_agent_id);
      paramIndex++;
    }

    const countResult = await this.dataSource.query(
      `SELECT COUNT(*) FROM ${tenantSchema}.tickets WHERE ${whereClause}`,
      params,
    );

    const total = parseInt(countResult[0].count);

    const result = await this.dataSource.query(
      `SELECT * FROM ${tenantSchema}.tickets 
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
      `SELECT * FROM ${tenantSchema}.tickets WHERE id = $1`,
      [id],
    );

    if (!result || result.length === 0) {
      throw new NotFoundException('Ticket not found');
    }

    return result[0];
  }

  async update(id: string, updateDto: UpdateTicketDto, tenantSchema: string) {
    const { subject, description, status, priority, assigned_agent_id } = updateDto;

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (subject) {
      updates.push(`subject = $${paramIndex}`);
      params.push(subject);
      paramIndex++;
    }

    if (description) {
      updates.push(`description = $${paramIndex}`);
      params.push(description);
      paramIndex++;
    }

    if (status) {
      updates.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
      
      if (status === 'resolved') {
        updates.push(`resolved_at = NOW()`);
      } else if (status === 'closed') {
        updates.push(`closed_at = NOW()`);
      }
    }

    if (priority) {
      updates.push(`priority = $${paramIndex}`);
      params.push(priority);
      paramIndex++;
    }

    if (assigned_agent_id !== undefined) {
      updates.push(`assigned_agent_id = $${paramIndex}`);
      params.push(assigned_agent_id);
      paramIndex++;
    }

    if (updates.length === 0) {
      return this.findOne(id, tenantSchema);
    }

    updates.push(`updated_at = NOW()`);

    const result = await this.dataSource.query(
      `UPDATE ${tenantSchema}.tickets 
       SET ${updates.join(', ')} 
       WHERE id = $${paramIndex} 
       RETURNING *`,
      [...params, id],
    );

    if (!result || result.length === 0) {
      throw new NotFoundException('Ticket not found');
    }

    return result[0];
  }

  async remove(id: string, tenantSchema: string) {
    const result = await this.dataSource.query(
      `DELETE FROM ${tenantSchema}.tickets WHERE id = $1 RETURNING *`,
      [id],
    );

    if (!result || result.length === 0) {
      throw new NotFoundException('Ticket not found');
    }

    return result[0];
  }
}
