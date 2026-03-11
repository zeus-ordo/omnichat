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
