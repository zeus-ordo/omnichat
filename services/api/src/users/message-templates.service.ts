import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class MessageTemplatesService {
  constructor(private dataSource: DataSource) {}

  async findAll(tenantSchema: string) {
    return this.dataSource.query(
      `SELECT id, name, content, type, trigger_keyword, is_active, created_at, updated_at 
       FROM ${tenantSchema}.message_templates 
       ORDER BY created_at DESC`,
    );
  }

  async findOne(tenantSchema: string, id: string) {
    const result = await this.dataSource.query(
      `SELECT id, name, content, type, trigger_keyword, is_active, created_at, updated_at 
       FROM ${tenantSchema}.message_templates WHERE id = $1`,
      [id],
    );
    if (!result.length) throw new NotFoundException('Template not found');
    return result[0];
  }

  async findByKeyword(tenantSchema: string, keyword: string) {
    const result = await this.dataSource.query(
      `SELECT id, name, content, type, is_active 
       FROM ${tenantSchema}.message_templates 
       WHERE trigger_keyword = $1 AND is_active = true`,
      [keyword],
    );
    return result[0] || null;
  }

  async create(tenantSchema: string, data: { 
    name: string; 
    content: string; 
    type?: string; 
    trigger_keyword?: string;
    is_active?: boolean;
  }) {
    const result = await this.dataSource.query(
      `INSERT INTO ${tenantSchema}.message_templates (name, content, type, trigger_keyword, is_active) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, name, content, type, trigger_keyword, is_active, created_at`,
      [
        data.name, 
        data.content, 
        data.type || 'text',
        data.trigger_keyword || null,
        data.is_active !== false
      ],
    );
    return result[0];
  }

  async update(tenantSchema: string, id: string, data: { 
    name?: string; 
    content?: string; 
    type?: string; 
    trigger_keyword?: string;
    is_active?: boolean;
  }) {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(data.name);
    }
    if (data.content !== undefined) {
      updates.push(`content = $${paramIndex++}`);
      params.push(data.content);
    }
    if (data.type !== undefined) {
      updates.push(`type = $${paramIndex++}`);
      params.push(data.type);
    }
    if (data.trigger_keyword !== undefined) {
      updates.push(`trigger_keyword = $${paramIndex++}`);
      params.push(data.trigger_keyword);
    }
    if (data.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(data.is_active);
    }

    if (updates.length === 0) return this.findOne(tenantSchema, id);

    params.push(id);
    const result = await this.dataSource.query(
      `UPDATE ${tenantSchema}.message_templates 
       SET ${updates.join(', ')} 
       WHERE id = $${paramIndex} 
       RETURNING id, name, content, type, trigger_keyword, is_active, created_at, updated_at`,
      params,
    );
    if (!result.length) throw new NotFoundException('Template not found');
    return result[0];
  }

  async delete(tenantSchema: string, id: string) {
    const result = await this.dataSource.query(
      `DELETE FROM ${tenantSchema}.message_templates WHERE id = $1 RETURNING id`,
      [id],
    );
    if (!result.length) throw new NotFoundException('Template not found');
    return { success: true };
  }
}
