import { Controller, Post, Body, Headers, HttpCode, Req, RawBodyRequest } from '@nestjs/common';
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
    @Req() req: RawBodyRequest<Request>,
  ) {
    // Verify signature in production
    // const isValid = this.lineService.verifySignature(signature, req.rawBody);
    // if (!isValid) throw new UnauthorizedException('Invalid signature');
    
    return this.lineService.handleWebhook(body);
  }
}
