import { Controller, Get, Post, Delete, Body, Param, Req } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';

interface RequestWithTenant extends Request {
  tenantId: string;
}

@Controller('api-keys')
export class ApiKeysController {
  constructor(private apiKeysService: ApiKeysService) {}

  @Get()
  findAll(@Req() req: RequestWithTenant) {
    return this.apiKeysService.findAll(req.tenantId);
  }

  @Post()
  create(@Body() data: { name?: string; expires_at?: string }, @Req() req: RequestWithTenant) {
    return this.apiKeysService.create(req.tenantId, data);
  }

  @Delete(':id')
  revoke(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.apiKeysService.revoke(id, req.tenantId);
  }

  @Get(':id/usage')
  getUsage(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.apiKeysService.getUsage(id, req.tenantId);
  }
}
