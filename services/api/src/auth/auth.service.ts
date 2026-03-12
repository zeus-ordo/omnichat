import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { LoginDto, RegisterDto, RefreshTokenDto } from './dto/auth.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private dataSource: DataSource,
  ) {}

  private isValidSchemaName(schemaName: string): boolean {
    return /^[a-z][a-z0-9_]*$/.test(schemaName) && schemaName.length <= 64;
  }

  private async findUserByEmailInSchema(email: string, schema: string) {
    if (!this.isValidSchemaName(schema)) return null;

    const result = await this.dataSource.query(
      `SELECT id, email, password_hash, name, role FROM ${schema}.users
       WHERE email = $1 AND is_active = true`,
      [email],
    );

    if (!result || result.length === 0) return null;
    return result[0];
  }

  private async findUserAcrossTenants(email: string, firstSchema?: string) {
    const tried = new Set<string>();

    if (firstSchema && this.isValidSchemaName(firstSchema)) {
      const firstUser = await this.findUserByEmailInSchema(email, firstSchema);
      tried.add(firstSchema);
      if (firstUser) {
        return { user: firstUser, tenantSchema: firstSchema };
      }
    }

    const tenants = await this.dataSource.query(
      `SELECT schema_name FROM tenants WHERE status = 'active' ORDER BY created_at DESC`,
    );

    for (const tenant of tenants) {
      const schema = tenant.schema_name as string;
      if (!this.isValidSchemaName(schema) || tried.has(schema)) continue;

      const found = await this.findUserByEmailInSchema(email, schema);
      if (found) {
        return { user: found, tenantSchema: schema };
      }
    }

    return null;
  }

  private async createTenantSchemaFromTemplate(schemaName: string) {
    if (!this.isValidSchemaName(schemaName)) {
      throw new UnauthorizedException('Invalid tenant schema');
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

  async login(loginDto: LoginDto, tenantSchema: string) {
    const { email, password } = loginDto;

    const account = await this.findUserAcrossTenants(email, tenantSchema);
    if (!account) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { user, tenantSchema: resolvedTenantSchema } = account;

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenant_schema: resolvedTenantSchema,
    };
    
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async register(registerDto: RegisterDto, tenantSchema: string) {
    const { email, password, name } = registerDto;

    const existing = await this.findUserAcrossTenants(email, tenantSchema);
    if (existing) {
      throw new ConflictException('User already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create isolated tenant for this new account
    const schemaName = `tenant_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
    const tenantName = (name?.trim() || email.split('@')[0] || 'New Tenant') + "'s Workspace";

    const tenantResult = await this.dataSource.query(
      `INSERT INTO tenants (name, schema_name, plan, status)
       VALUES ($1, $2, 'free', 'active')
       RETURNING id, schema_name`,
      [tenantName, schemaName],
    );

    await this.createTenantSchemaFromTemplate(schemaName);

    // Create user
    const result = await this.dataSource.query(
      `INSERT INTO ${schemaName}.users (email, password_hash, name, role)
       VALUES ($1, $2, $3, 'owner')
       RETURNING id, email, name, role`,
      [email, passwordHash, name],
    );

    const user = result[0];
    const tenant = tenantResult[0];

    // Generate tokens
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenant_schema: tenant.schema_name,
      tenant_id: tenant.id,
    };
    
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async validateUser(userId: string, tenantSchema: string) {
    const result = await this.dataSource.query(
      `SELECT id, email, name, role FROM ${tenantSchema}.users 
       WHERE id = $1 AND is_active = true`,
      [userId],
    );

    if (!result || result.length === 0) {
      return null;
    }

    return result[0];
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    try {
      const payload = this.jwtService.verify(refreshTokenDto.refresh_token);
      
      return {
        access_token: this.jwtService.sign({
          sub: payload.sub,
          email: payload.email,
          role: payload.role,
          tenant_schema: payload.tenant_schema,
          tenant_id: payload.tenant_id,
        }),
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
