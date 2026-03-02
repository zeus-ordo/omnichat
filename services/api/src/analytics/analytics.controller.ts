import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  @Get('overview')
  getOverview(@Req() req: Request) {
    return {
      total_conversations: 0,
      active_conversations: 0,
      total_messages: 0,
      total_tokens: 0,
    };
  }

  @Get('channels')
  getByChannel(@Req() req: Request) {
    return [];
  }

  @Get('daily')
  getDaily(@Query('days') days: string, @Req() req: Request) {
    return [];
  }
}
