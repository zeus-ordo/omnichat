import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

interface RequestWithTenant extends Request {
  tenantSchema: string;
}

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  findAll(@Req() req: RequestWithTenant) {
    return this.usersService.findAll(req.tenantSchema);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  findOne(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.usersService.findOne(req.tenantSchema, id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  create(@Body() data: { email: string; password: string; name?: string; role?: string }, @Req() req: RequestWithTenant) {
    return this.usersService.create(req.tenantSchema, data);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  update(@Param('id') id: string, @Body() data: { name?: string; role?: string; is_active?: boolean }, @Req() req: RequestWithTenant) {
    return this.usersService.update(req.tenantSchema, id, data);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  delete(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.usersService.delete(req.tenantSchema, id);
  }

  @Post(':id/reset-password')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  resetPassword(@Param('id') id: string, @Body() data: { password: string }, @Req() req: RequestWithTenant) {
    return this.usersService.resetPassword(req.tenantSchema, id, data.password);
  }
}
