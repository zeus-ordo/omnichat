import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BroadcastsService } from './broadcasts.service';
import { CreateBroadcastDto, BroadcastQueryDto } from './dto/broadcasts.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Broadcasts')
@Controller('broadcasts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BroadcastsController {
  constructor(private readonly broadcastsService: BroadcastsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new broadcast' })
  create(@Body() createDto: CreateBroadcastDto, @Request() req) {
    return this.broadcastsService.create(createDto, req.tenantSchema, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all broadcasts' })
  findAll(@Query() query: BroadcastQueryDto, @Request() req) {
    return this.broadcastsService.findAll(query, req.tenantSchema);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a broadcast by ID' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.broadcastsService.findOne(id, req.tenantSchema);
  }

  @Post(':id/send')
  @ApiOperation({ summary: 'Send a broadcast' })
  send(@Param('id') id: string, @Request() req) {
    return this.broadcastsService.send(id, req.tenantSchema);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a broadcast' })
  cancel(@Param('id') id: string, @Request() req) {
    return this.broadcastsService.cancel(id, req.tenantSchema);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a broadcast' })
  remove(@Param('id') id: string, @Request() req) {
    return this.broadcastsService.remove(id, req.tenantSchema);
  }
}
