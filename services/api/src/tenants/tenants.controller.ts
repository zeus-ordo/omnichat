import { Controller, Get, Post, Put, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Tenants')
@Controller('tenants')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  findAll() {
    return this.tenantsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('owner')
  create(@Body() data: { name: string; plan?: string }) {
    return this.tenantsService.create(data);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('owner')
  update(@Param('id') id: string, @Body() data: any) {
    return this.tenantsService.update(id, data);
  }

  @Post(':id/api-keys')
  @UseGuards(RolesGuard)
  @Roles('owner')
  createApiKey(@Param('id') id: string, @Body() data: { name?: string }) {
    return this.tenantsService.createApiKey(id, data.name);
  }
}
