import { Controller, Post, Get, Query, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FacebookService } from './facebook.service';

@ApiTags('Facebook Channel')
@Controller('webhooks/facebook')
export class FacebookController {
  constructor(private readonly facebookService: FacebookService) {}

  @Get()
  @ApiOperation({ summary: 'Facebook Webhook verification' })
  async verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const result = await this.facebookService.verifyWebhook(mode, token, challenge);
    return result || 'Verification failed';
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Facebook Webhook endpoint' })
  async handleWebhook(@Body() body: any) {
    return this.facebookService.handleWebhook(body);
  }
}
