import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';

// 白名單：允許的 schema 字元 (只允許字母、數字、底線)
const VALID_SCHEMA_PATTERN = /^[a-z][a-z0-9_]*$/;

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private dataSource: DataSource,
    private jwtService: JwtService,
  ) {}

  private validateSchemaName(schemaName: string): boolean {
    // 驗證 schema 名稱是否符合安全規範
    return VALID_SCHEMA_PATTERN.test(schemaName) && schemaName.length <= 64;
  }

  private escapeIdentifier(identifier: string): string {
    // 使用雙引號包覆識別符，防止 SQL 注入
    return '"' + identifier.replace(/"/g, '""') + '"';
  }

  async use(req: Request, res: Response, next: NextFunction) {
    // Skip for public endpoints - auth and docs
    const publicPaths = ['/api/auth', '/api/docs', '/health', '/api/health'];
    const requestPath = req.path;
    
    if (publicPaths.some((path) => requestPath.startsWith(path))) {
      // For auth routes, use default tenant
      (req as any).tenantSchema = 'tenant_demo';
      return next();
    }

    // Prefer tenant from JWT bearer token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const payload: any = this.jwtService.verify(token);
        const tokenSchema = payload?.tenant_schema;

        if (tokenSchema && this.validateSchemaName(tokenSchema)) {
          (req as any).tenantSchema = tokenSchema;
          (req as any).tenantId = payload?.tenant_id;

          const safeSchema = this.escapeIdentifier(tokenSchema);
          await this.dataSource.query(`SET search_path TO ${safeSchema}, public`);
          return next();
        }
      } catch {
        // Ignore invalid token here, let auth guard handle it later
      }
    }

    // Get API key from header
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      const queryApiKey = req.query['api_key'] as string;
      if (!queryApiKey) {
        // Use default tenant for development
        (req as any).tenantSchema = 'tenant_demo';
        return next();
      }
      req.headers['x-api-key'] = queryApiKey;
    }

    // Hash the API key for lookup
    const keyHash = crypto
      .createHash('sha256')
      .update(req.headers['x-api-key'] as string)
      .digest('hex');

    // Look up tenant by API key
    const apiKeyRecord = await this.dataSource.query(
      `SELECT ak.tenant_id, t.schema_name, t.status, t.settings 
       FROM api_keys ak 
       JOIN tenants t ON ak.tenant_id = t.id 
       WHERE ak.key_hash = $1 AND (ak.expires_at IS NULL OR ak.expires_at > NOW())`,
      [keyHash],
    );

    if (!apiKeyRecord || apiKeyRecord.length === 0) {
      // Fall back to default tenant
      (req as any).tenantSchema = 'tenant_demo';
      return next();
    }

    const tenant = apiKeyRecord[0];

    if (tenant.status !== 'active') {
      throw new UnauthorizedException('Tenant is not active');
    }

    // 驗證 schema 名稱安全性
    const schemaName = tenant.schema_name;
    if (!this.validateSchemaName(schemaName)) {
      throw new BadRequestException('Invalid tenant schema name');
    }

    // Attach tenant info to request
    (req as any).tenantId = tenant.tenant_id;
    (req as any).tenantSchema = schemaName;
    (req as any).tenantSettings = tenant.settings;

    // Set PostgreSQL search path for this tenant (使用安全的識別符)
    const safeSchema = this.escapeIdentifier(schemaName);
    await this.dataSource.query(
      `SET search_path TO ${safeSchema}, public`,
    );

    next();
  }
}
