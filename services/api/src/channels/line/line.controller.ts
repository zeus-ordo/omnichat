import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  Req,
  RawBodyRequest,
  Query,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LineService } from './line.service';
import { Request } from 'express';

@ApiTags('LINE Channel')
@Controller('webhooks/line')
export class LineController {
  constructor(private readonly lineService: LineService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'LINE Webhook endpoint' })
  async handleWebhook(
    @Body() body: any,
    @Headers('x-line-signature') signature: string,
    @Query('bot_id') botId: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const tenantSchema = (req as any).tenantSchema;
    if (!tenantSchema) {
      throw new BadRequestException('tenantSchema is missing');
    }

    const lineConfig = await this.lineService.resolveLineConfig(tenantSchema, botId);
    if (!lineConfig) {
      throw new UnauthorizedException('LINE channel is not configured');
    }

    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(body || {});
    const isValid = this.lineService.verifySignature(
      signature || '',
      rawBody,
      lineConfig.channelSecret,
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid LINE signature');
    }

    return this.lineService.handleWebhook(body, lineConfig.channelAccessToken);
  }
}
