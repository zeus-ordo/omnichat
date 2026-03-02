import { Controller, Get, Post, Body, Query, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { WhatsAppService, WhatsAppConfig } from './whatsapp.service';

@Controller('channels/whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsAppService: WhatsAppService) {}

  @Get('config')
  getConfig(@Req() req: Request) {
    const tenantSchema = (req as any).tenantSchema;
    return this.whatsAppService.getConfig(tenantSchema);
  }

  @Post('configure')
  configure(@Body() config: WhatsAppConfig, @Req() req: Request) {
    const tenantSchema = (req as any).tenantSchema;
    return this.whatsAppService.configure(tenantSchema, config);
  }

  @Post('disable')
  disable(@Req() req: Request) {
    const tenantSchema = (req as any).tenantSchema;
    return this.whatsAppService.disable(tenantSchema);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  handleWebhook(@Body() payload: any, @Req() req: Request) {
    const tenantSchema = (req as any).tenantSchema;
    return this.whatsAppService.handleWebhook(payload, tenantSchema);
  }

  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Req() req: Request,
  ) {
    const tenantSchema = (req as any).tenantSchema;
    return this.whatsAppService.verifyWebhook(mode, token, challenge, tenantSchema);
  }

  @Post('send')
  sendMessage(
    @Body() body: { to: string; content: string },
    @Req() req: Request,
  ) {
    const tenantSchema = (req as any).tenantSchema;
    return this.whatsAppService.sendMessage(body.to, body.content, tenantSchema);
  }
}
