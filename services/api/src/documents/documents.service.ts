import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DocumentsService {
  constructor(private dataSource: DataSource) {}

  async findAll(tenantSchema: string) {
    return this.dataSource.query(
      `SELECT * FROM ${tenantSchema}.documents ORDER BY created_at DESC`,
    );
  }

  async findOne(tenantSchema: string, id: string) {
    const result = await this.dataSource.query(
      `SELECT * FROM ${tenantSchema}.documents WHERE id = $1`,
      [id],
    );
    return result[0];
  }

  async create(
    tenantSchema: string,
    data: { name: string; type: string; file_url?: string },
  ) {
    const result = await this.dataSource.query(
      `INSERT INTO ${tenantSchema}.documents (name, type, file_url, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [data.name, data.type, data.file_url],
    );
    return result[0];
  }

  async updateStatus(tenantSchema: string, id: string, status: string, extra?: any) {
    const updates: string[] = ['status = $2', 'updated_at = NOW()'];
    const params: any[] = [id, status];
    let paramIndex = 3;

    if (status === 'ready' && extra?.content_text) {
      updates.push(`content_text = $${paramIndex++}`);
      params.push(extra.content_text);
    }
    if (status === 'error' && extra?.error_message) {
      updates.push(`error_message = $${paramIndex++}`);
      params.push(extra.error_message);
    }

    const result = await this.dataSource.query(
      `UPDATE ${tenantSchema}.documents SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      params,
    );
    return result[0];
  }
}
