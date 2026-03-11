import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

type BotConfig = {
  id: string;
  name: string;
  avatar?: string;
  model: string;
  database: string;
  channels: Array<{ id: string; type: 'web' | 'line' | 'facebook' | 'api'; enabled: boolean; name: string }>;
  surveys: string[];
  surveysCount: number;
  documentsCount: number;
  conversationsCount: number;
  messagesCount: number;
  lastActive: string;
  isActive: boolean;
  channelConfigs?: Record<string, Record<string, string>>;
};

@Injectable()
export class BotsService {
  constructor(private readonly dataSource: DataSource) {}

  private async getTenantSettings(tenantSchema: string): Promise<any> {
    const rows = await this.dataSource.query(
      `SELECT settings FROM tenants WHERE schema_name = $1 LIMIT 1`,
      [tenantSchema],
    );

    if (!rows?.length) {
      throw new NotFoundException('Tenant not found');
    }

    return rows[0].settings || {};
  }

  private async saveBots(tenantSchema: string, bots: BotConfig[]) {
    await this.dataSource.query(
      `UPDATE tenants
       SET settings = COALESCE(settings, '{}'::jsonb)
                    || jsonb_build_object('website_bots', $1::jsonb)
       WHERE schema_name = $2`,
      [JSON.stringify(bots), tenantSchema],
    );
  }

  async findAll(tenantSchema: string): Promise<BotConfig[]> {
    const settings = await this.getTenantSettings(tenantSchema);
    const bots = settings?.website_bots;
    return Array.isArray(bots) ? bots : [];
  }

  async create(tenantSchema: string, payload: Partial<BotConfig>) {
    const bots = await this.findAll(tenantSchema);
    const bot: BotConfig = {
      id: uuidv4(),
      name: payload.name || 'New Bot',
      avatar: payload.avatar,
      model: payload.model || 'GPT-4o',
      database: payload.database || '',
      channels: payload.channels || [
        { id: '1', type: 'web', enabled: true, name: 'Website' },
        { id: '2', type: 'line', enabled: false, name: 'LINE' },
        { id: '3', type: 'facebook', enabled: false, name: 'Facebook' },
        { id: '4', type: 'api', enabled: false, name: 'REST API' },
      ],
      surveys: payload.surveys || [],
      surveysCount: payload.surveysCount || 0,
      documentsCount: payload.documentsCount || 0,
      conversationsCount: payload.conversationsCount || 0,
      messagesCount: payload.messagesCount || 0,
      lastActive: payload.lastActive || 'Just now',
      isActive: payload.isActive ?? true,
      channelConfigs: payload.channelConfigs || {},
    };

    const next = [...bots, bot];
    await this.saveBots(tenantSchema, next);
    return bot;
  }

  async update(tenantSchema: string, id: string, payload: Partial<BotConfig>) {
    const bots = await this.findAll(tenantSchema);
    const index = bots.findIndex((item) => item.id === id);

    if (index < 0) {
      throw new NotFoundException('Bot not found');
    }

    const updated = {
      ...bots[index],
      ...payload,
      id,
    } as BotConfig;

    const next = [...bots];
    next[index] = updated;
    await this.saveBots(tenantSchema, next);
    return updated;
  }

  async remove(tenantSchema: string, id: string) {
    const bots = await this.findAll(tenantSchema);
    const next = bots.filter((item) => item.id !== id);
    await this.saveBots(tenantSchema, next);
    return { success: true };
  }
}
