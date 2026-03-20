import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { CreateTicketDto, TicketQueryDto, UpdateTicketDto } from './dto/tickets.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Tickets')
@Controller('tickets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin', 'agent')
  @ApiOperation({ summary: 'Create a new ticket' })
  create(@Body() createDto: CreateTicketDto, @Req() req: Request) {
    return this.ticketsService.create(createDto, (req as any).tenantSchema, (req as any).user.id);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin', 'agent', 'viewer')
  @ApiOperation({ summary: 'Get all tickets' })
  findAll(@Query() query: TicketQueryDto, @Req() req: Request) {
    return this.ticketsService.findAll(query, (req as any).tenantSchema);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin', 'agent', 'viewer')
  @ApiOperation({ summary: 'Get a ticket by ID' })
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.ticketsService.findOne(id, (req as any).tenantSchema);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin', 'agent')
  @ApiOperation({ summary: 'Update a ticket' })
  update(@Param('id') id: string, @Body() updateDto: UpdateTicketDto, @Req() req: Request) {
    return this.ticketsService.update(id, updateDto, (req as any).tenantSchema);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Delete a ticket' })
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.ticketsService.remove(id, (req as any).tenantSchema);
  }
}
