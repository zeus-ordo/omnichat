import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';

@Injectable()
export class ApiKeysService {
  constructor(private dataSource: DataSource) {}

  async findAll(tenantId: string) {
    return this.dataSource.query(
      `SELECT id, name, last_used_at, expires_at, created_at 
       FROM api_keys 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC`,
      [tenantId],
    );
  }

  async create(tenantId: string, data: { name?: string; expires_at?: string }) {
    // Generate API key
    const apiKey = `omni_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const result = await this.dataSource.query(
      `INSERT INTO api_keys (tenant_id, key_hash, name, expires_at) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, name, expires_at, created_at`,
      [tenantId, keyHash, data.name || 'API Key', data.expires_at || null],
    );

    // Return the API key only once
    return {
      ...result[0],
      api_key: apiKey,
    };
  }

  async revoke(id: string, tenantId: string) {
    const result = await this.dataSource.query(
      `DELETE FROM api_keys WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [id, tenantId],
    );
    if (!result.length) throw new NotFoundException('API Key not found');
    return { success: true };
  }

  async getUsage(id: string, tenantId: string) {
    // Get API key usage stats
    const keyInfo = await this.dataSource.query(
      `SELECT id, name, last_used_at, created_at FROM api_keys WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (!keyInfo.length) throw new NotFoundException('API Key not found');

    // Get approximate usage from logs (if available)
    // For now, return basic info
    return {
      ...keyInfo[0],
      requests_today: 0, // TODO: Implement actual tracking
      requests_this_month: 0,
    };
  }
}
