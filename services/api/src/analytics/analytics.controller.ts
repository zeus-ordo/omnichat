import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  getOverview(@Req() req: Request) {
    const tenantSchema = (req as any).tenantSchema;
    return this.analyticsService.getOverview(tenantSchema);
  }

  @Get('channels')
  getByChannel(@Req() req: Request) {
    const tenantSchema = (req as any).tenantSchema;
    return this.analyticsService.getConversationsByChannel(tenantSchema);
  }

  @Get('daily')
  getDaily(@Query('days') days: string, @Req() req: Request) {
    const tenantSchema = (req as any).tenantSchema;
    return this.analyticsService.getDailyStats(tenantSchema, parseInt(days) || 30);
  }

  @Get('hourly')
  getHourly(@Query('days') days: string, @Req() req: Request) {
    const tenantSchema = (req as any).tenantSchema;
    return this.analyticsService.getHourlyStats(tenantSchema, parseInt(days) || 7);
  }

  @Get('ai-performance')
  getAiPerformance(@Query('days') days: string, @Req() req: Request) {
    const tenantSchema = (req as any).tenantSchema;
    return this.analyticsService.getAiPerformance(tenantSchema, parseInt(days) || 30);
  }

  @Get('conversation-metrics')
  getConversationMetrics(@Query('days') days: string, @Req() req: Request) {
    const tenantSchema = (req as any).tenantSchema;
    return this.analyticsService.getConversationMetrics(tenantSchema, parseInt(days) || 30);
  }

  @Get('response-time')
  getResponseTime(@Query('days') days: string, @Req() req: Request) {
    const tenantSchema = (req as any).tenantSchema;
    return this.analyticsService.getResponseTimeStats(tenantSchema, parseInt(days) || 30);
  }

  @Get('channel-comparison')
  getChannelComparison(@Query('days') days: string, @Req() req: Request) {
    const tenantSchema = (req as any).tenantSchema;
    return this.analyticsService.getChannelComparison(tenantSchema, parseInt(days) || 30);
  }

  @Get('customer-satisfaction')
  getCustomerSatisfaction(@Req() req: Request) {
    const tenantSchema = (req as any).tenantSchema;
    return this.analyticsService.getCustomerSatisfaction(tenantSchema);
  }

  @Get('agent-performance')
  getAgentPerformance(@Query('days') days: string, @Req() req: Request) {
    const tenantSchema = (req as any).tenantSchema;
    return this.analyticsService.getAgentPerformance(tenantSchema, parseInt(days) || 30);
  }

  @Get('message-trends')
  getMessageTrends(@Query('days') days: string, @Req() req: Request) {
    const tenantSchema = (req as any).tenantSchema;
    return this.analyticsService.getMessageTrends(tenantSchema, parseInt(days) || 30);
  }

  @Get('popular-topics')
  getPopularTopics(@Query('limit') limit: string, @Req() req: Request) {
    const tenantSchema = (req as any).tenantSchema;
    return this.analyticsService.getPopularTopics(tenantSchema, parseInt(limit) || 10);
  }
}
