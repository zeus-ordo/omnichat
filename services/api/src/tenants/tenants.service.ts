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

    await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

    await this.dataSource.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        role VARCHAR(50) NOT NULL DEFAULT 'agent' CHECK (role IN ('owner', 'admin', 'agent', 'viewer')),
        is_active BOOLEAN DEFAULT true,
        last_login_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".conversations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        channel VARCHAR(50) NOT NULL DEFAULT 'web' CHECK (channel IN ('web', 'line', 'facebook', 'api')),
        channel_user_id VARCHAR(255),
        status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
        assigned_agent_id UUID,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        conversation_id UUID NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        tokens_used INTEGER DEFAULT 0,
        model_used VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".documents (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL CHECK (type IN ('pdf', 'word', 'txt', 'url', 'html')),
        status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'error')),
        file_url TEXT,
        content_text TEXT,
        error_message TEXT,
        uploaded_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".flows (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        nodes JSONB DEFAULT '[]',
        edges JSONB DEFAULT '[]',
        is_active BOOLEAN DEFAULT false,
        created_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".flow_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        conversation_id UUID NOT NULL,
        flow_id UUID NOT NULL,
        node_id VARCHAR(100) NOT NULL,
        node_type VARCHAR(50),
        input_data JSONB DEFAULT '{}',
        output_data JSONB DEFAULT '{}',
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".surveys (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        questions JSONB DEFAULT '[]',
        trigger_keywords TEXT[] DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".survey_responses (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        conversation_id UUID NOT NULL,
        survey_id UUID NOT NULL,
        answers JSONB DEFAULT '{}',
        submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".message_templates (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'button', 'image', 'carousel')),
        trigger_keyword VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        created_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".tickets (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        conversation_id UUID,
        subject VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
        priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
        assigned_agent_id UUID,
        created_by UUID,
        resolved_at TIMESTAMP WITH TIME ZONE,
        closed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".broadcasts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        subject VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        channel VARCHAR(50) NOT NULL DEFAULT 'all' CHECK (channel IN ('all', 'web', 'line', 'facebook', 'api')),
        status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent', 'cancelled')),
        scheduled_at TIMESTAMP WITH TIME ZONE,
        sent_at TIMESTAMP WITH TIME ZONE,
        recipient_count INTEGER DEFAULT 0,
        created_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

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
