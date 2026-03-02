import { Injectable, Controller, Get, Post, Param, Body, Req } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Injectable()
export class ChannelsService {
  async getChannels(tenantSchema: string) {
    return [
      { id: 'web', name: 'Web Widget', enabled: true },
      { id: 'line', name: 'LINE', enabled: false },
      { id: 'facebook', name: 'Facebook Messenger', enabled: false },
      { id: 'api', name: 'REST API', enabled: true },
    ];
  }

  async configureChannel(tenantSchema: string, channelId: string, config: any) {
    return { channel_id: channelId, config, enabled: true };
  }
}

@Controller('channels')
export class ChannelsController {
  @Get()
  getChannels(@Req() req: Request) {
    const tenantSchema = (req as any).tenantSchema;
    const service = new ChannelsService();
    return service.getChannels(tenantSchema);
  }

  @Post(':id/configure')
  configureChannel(
    @Param('id') id: string,
    @Body() config: any,
    @Req() req: Request,
  ) {
    const tenantSchema = (req as any).tenantSchema;
    const service = new ChannelsService();
    return service.configureChannel(tenantSchema, id, config);
  }
}
