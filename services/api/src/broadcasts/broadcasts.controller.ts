import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BroadcastsService } from './broadcasts.service';
import { CreateBroadcastDto, BroadcastQueryDto } from './dto/broadcasts.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Request as ExpressRequest } from 'express';

@ApiTags('Broadcasts')
@Controller('broadcasts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BroadcastsController {
  constructor(private readonly broadcastsService: BroadcastsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Create a new broadcast' })
  create(@Body() createDto: CreateBroadcastDto, @Req() req: ExpressRequest) {
    return this.broadcastsService.create(createDto, (req as any).tenantSchema, (req as any).user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all broadcasts' })
  findAll(@Query() query: BroadcastQueryDto, @Req() req: ExpressRequest) {
    return this.broadcastsService.findAll(query, (req as any).tenantSchema);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a broadcast by ID' })
  findOne(@Param('id') id: string, @Req() req: ExpressRequest) {
    return this.broadcastsService.findOne(id, (req as any).tenantSchema);
  }

  @Post(':id/send')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Send a broadcast' })
  send(@Param('id') id: string, @Req() req: ExpressRequest) {
    return this.broadcastsService.send(id, (req as any).tenantSchema);
  }

  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Cancel a broadcast' })
  cancel(@Param('id') id: string, @Req() req: ExpressRequest) {
    return this.broadcastsService.cancel(id, (req as any).tenantSchema);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Delete a broadcast' })
  remove(@Param('id') id: string, @Req() req: ExpressRequest) {
    return this.broadcastsService.remove(id, (req as any).tenantSchema);
  }
}
