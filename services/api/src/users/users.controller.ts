import { Controller, Get, Post, Put, Delete, Body, Param, Req } from '@nestjs/common';
import { UsersService } from './users.service';

interface RequestWithTenant extends Request {
  tenantSchema: string;
}

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  findAll(@Req() req: RequestWithTenant) {
    return this.usersService.findAll(req.tenantSchema);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.usersService.findOne(req.tenantSchema, id);
  }

  @Post()
  create(@Body() data: { email: string; password: string; name?: string; role?: string }, @Req() req: RequestWithTenant) {
    return this.usersService.create(req.tenantSchema, data);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: { name?: string; role?: string; is_active?: boolean }, @Req() req: RequestWithTenant) {
    return this.usersService.update(req.tenantSchema, id, data);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.usersService.delete(req.tenantSchema, id);
  }

  @Post(':id/reset-password')
  resetPassword(@Param('id') id: string, @Body() data: { password: string }, @Req() req: RequestWithTenant) {
    return this.usersService.resetPassword(req.tenantSchema, id, data.password);
  }
}
