import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { CreateTicketDto, TicketQueryDto, UpdateTicketDto } from './dto/tickets.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Tickets')
@Controller('tickets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new ticket' })
  create(@Body() createDto: CreateTicketDto, @Request() req) {
    return this.ticketsService.create(createDto, req.tenantSchema, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tickets' })
  findAll(@Query() query: TicketQueryDto, @Request() req) {
    return this.ticketsService.findAll(query, req.tenantSchema);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a ticket by ID' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.ticketsService.findOne(id, req.tenantSchema);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a ticket' })
  update(@Param('id') id: string, @Body() updateDto: UpdateTicketDto, @Request() req) {
    return this.ticketsService.update(id, updateDto, req.tenantSchema);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a ticket' })
  remove(@Param('id') id: string, @Request() req) {
    return this.ticketsService.remove(id, req.tenantSchema);
  }
}
