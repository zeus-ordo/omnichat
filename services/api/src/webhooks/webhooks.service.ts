import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class WebhooksService {
  constructor(private dataSource: DataSource) {}

  async findAll(tenantId: string) {
    return this.dataSource.query(
      'SELECT * FROM webhooks WHERE tenant_id = $1',
      [tenantId],
    );
  }

  async create(tenantId: string, data: { url: string; events: string[]; secret?: string }) {
    const result = await this.dataSource.query(
      `INSERT INTO webhooks (tenant_id, url, events, secret) VALUES ($1, $2, $3, $4) RETURNING *`,
      [tenantId, data.url, data.events, data.secret],
    );
    return result[0];
  }

  async delete(tenantId: string, id: string) {
    await this.dataSource.query('DELETE FROM webhooks WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    return { deleted: true };
  }

  async trigger(tenantId: string, event: string, data: any) {
    const webhooks = await this.dataSource.query(
      'SELECT * FROM webhooks WHERE tenant_id = $1 AND $2 = ANY(events) AND is_active = true',
      [tenantId, event],
    );

    for (const webhook of webhooks) {
      try {
        await fetch(webhook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event, data, timestamp: new Date().toISOString() }),
        });
      } catch (error) {
        console.error(`Webhook failed: ${webhook.url}`, error);
      }
    }
  }
}
