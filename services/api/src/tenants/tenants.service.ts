import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TenantsService {
  constructor(private dataSource: DataSource) {}

  private isValidSchemaName(schemaName: string): boolean {
    return /^[a-z][a-z0-9_]*$/.test(schemaName) && schemaName.length <= 64;
  }

  private async createTenantSchemaFromTemplate(schemaName: string) {
    if (!this.isValidSchemaName(schemaName)) {
      throw new Error('Invalid schema name');
    }

    const tables = [
      'users',
      'conversations',
      'messages',
      'documents',
      'flows',
      'flow_logs',
      'surveys',
      'survey_responses',
      'message_templates',
      'tickets',
      'broadcasts',
    ];

    await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

    for (const table of tables) {
      await this.dataSource.query(
        `CREATE TABLE IF NOT EXISTS "${schemaName}".${table} (LIKE tenant_demo.${table} INCLUDING ALL)`,
      );
    }

    const triggerTables = [
      'users',
      'conversations',
      'documents',
      'flows',
      'surveys',
      'message_templates',
      'tickets',
      'broadcasts',
    ];

    for (const table of triggerTables) {
      await this.dataSource.query(
        `DROP TRIGGER IF EXISTS update_${schemaName}_${table}_updated_at ON "${schemaName}".${table}`,
      );
      await this.dataSource.query(
        `CREATE TRIGGER update_${schemaName}_${table}_updated_at BEFORE UPDATE ON "${schemaName}".${table}
         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      );
    }
  }

  async findAll() {
    return this.dataSource.query('SELECT * FROM tenants ORDER BY created_at DESC');
  }

  async findOne(id: string) {
    const result = await this.dataSource.query(
      'SELECT * FROM tenants WHERE id = $1',
      [id],
    );
    if (!result.length) throw new NotFoundException('Tenant not found');
    return result[0];
  }

  async create(data: { name: string; plan?: string }) {
    const schemaName = `tenant_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
    
    const result = await this.dataSource.query(
      `INSERT INTO tenants (name, schema_name, plan, status) 
       VALUES ($1, $2, $3, 'active') 
       RETURNING *`,
      [data.name, schemaName, data.plan || 'free'],
    );

    await this.createTenantSchemaFromTemplate(schemaName);

    return result[0];
  }

  async update(id: string, data: { name?: string; plan?: string; status?: string; settings?: any }) {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (data.name) {
      updates.push(`name = $${paramIndex++}`);
      params.push(data.name);
    }
    if (data.plan) {
      updates.push(`plan = $${paramIndex++}`);
      params.push(data.plan);
    }
    if (data.status) {
      updates.push(`status = $${paramIndex++}`);
      params.push(data.status);
    }
    if (data.settings) {
      updates.push(`settings = $${paramIndex++}`);
      params.push(JSON.stringify(data.settings));
    }

    if (updates.length === 0) return this.findOne(id);

    params.push(id);
    const result = await this.dataSource.query(
      `UPDATE tenants SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
      params,
    );
    if (!result.length) throw new NotFoundException('Tenant not found');
    return result[0];
  }

  async createApiKey(tenantId: string, name?: string) {
    const apiKey = `ob_${uuidv4().replace(/-/g, '')}`;
    const keyHash = require('crypto').createHash('sha256').update(apiKey).digest('hex');
    
    const result = await this.dataSource.query(
      `INSERT INTO api_keys (tenant_id, key_hash, name) VALUES ($1, $2, $3) RETURNING *`,
      [tenantId, keyHash, name || 'Default Key'],
    );

    return { ...result[0], api_key: apiKey };
  }
}
