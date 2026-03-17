import { Controller, Get, Post, Delete, Body, Param, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface RequestWithTenant extends Request {
  tenantId: string;
}

@Controller('api-keys')
@UseGuards(JwtAuthGuard)
export class ApiKeysController {
  constructor(private apiKeysService: ApiKeysService) {}

  private requireTenantId(req: RequestWithTenant): string {
    if (!req.tenantId) {
      throw new UnauthorizedException('Tenant context is missing. Please login again.');
    }

    return req.tenantId;
  }

  @Get()
  findAll(@Req() req: RequestWithTenant) {
    return this.apiKeysService.findAll(this.requireTenantId(req));
  }

  @Post()
  create(@Body() data: { name?: string; expires_at?: string }, @Req() req: RequestWithTenant) {
    return this.apiKeysService.create(this.requireTenantId(req), data);
  }

  @Delete(':id')
  revoke(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.apiKeysService.revoke(id, this.requireTenantId(req));
  }

  @Get(':id/usage')
  getUsage(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.apiKeysService.getUsage(id, this.requireTenantId(req));
  }
}
