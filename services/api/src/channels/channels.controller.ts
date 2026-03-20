import { Injectable, Controller, Get, Post, Param, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Injectable()
export class ChannelsService {
  constructor(private dataSource: DataSource) {}

  async getChannels(tenantSchema: string) {
    // Get tenant settings to check enabled channels
    let enabledChannels: string[] = ['web', 'api'];
    
    try {
      const result = await this.dataSource.query(
        `SELECT settings FROM tenants WHERE schema_name = $1`,
        [tenantSchema],
      );
      const settings = result[0]?.settings || {};
      const channels = settings.channels || {};
      
      // Check which channels are enabled in settings
      if (channels.line) enabledChannels.push('line');
      if (channels.facebook) enabledChannels.push('facebook');
      if (channels.whatsapp?.enabled) enabledChannels.push('whatsapp');
    } catch (e) {
      // Default channels if settings can't be read
    }

    return [
      { id: 'web', name: 'Web Widget', enabled: enabledChannels.includes('web') },
      { id: 'line', name: 'LINE', enabled: enabledChannels.includes('line') },
      { id: 'facebook', name: 'Facebook Messenger', enabled: enabledChannels.includes('facebook') },
      { id: 'whatsapp', name: 'WhatsApp', enabled: enabledChannels.includes('whatsapp') },
      { id: 'api', name: 'REST API', enabled: enabledChannels.includes('api') },
    ];
  }

  async configureChannel(tenantSchema: string, channelId: string, config: any) {
    return { channel_id: channelId, config, enabled: true };
  }
}

@ApiTags('Channels')
@ApiBearerAuth()
@Controller('channels')
@UseGuards(JwtAuthGuard)
export class ChannelsController {
  @Get()
  @ApiOperation({ summary: 'Get all channels for tenant' })
  getChannels(@Req() req: Request) {
    const tenantSchema = (req as any).tenantSchema;
    const service = new ChannelsService(new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USER || 'omnibot',
      password: process.env.DB_PASSWORD || 'omnibot_secure_pass',
      database: process.env.DB_NAME || 'omnibot',
    }));
    return service.getChannels(tenantSchema);
  }

  @Post(':id/configure')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Configure a channel' })
  configureChannel(
    @Param('id') id: string,
    @Body() config: any,
    @Req() req: Request,
  ) {
    const tenantSchema = (req as any).tenantSchema;
    const service = new ChannelsService(new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USER || 'omnibot',
      password: process.env.DB_PASSWORD || 'omnibot_secure_pass',
      database: process.env.DB_NAME || 'omnibot',
    }));
    return service.configureChannel(tenantSchema, id, config);
  }
}
