import { Controller, Get, Post, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('webhooks')
@UseGuards(JwtAuthGuard)
export class WebhooksController {
  @Get()
  findAll(@Req() req: Request) {
    return [];
  }

  @Post()
  create(@Body() data: any, @Req() req: Request) {
    return { success: true };
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: Request) {
    return { deleted: true };
  }
}
