import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BotsService } from './bots.service';
import { DataSource } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';

@ApiTags('Bots')
@Controller('bots')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BotsController {
  constructor(
    private readonly botsService: BotsService,
    private readonly dataSource: DataSource,
    private readonly aiService: AiService,
  ) {}

  private isValidSchemaName(schemaName: string): boolean {
    return /^[a-z][a-z0-9_]*$/.test(schemaName) && schemaName.length <= 64;
  }

  private async ensureWebhookLogsTable() {
    await this.dataSource.query(
      `CREATE TABLE IF NOT EXISTS webhook_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_schema VARCHAR(63) NOT NULL,
        bot_id VARCHAR(255) NOT NULL,
        external_user_id VARCHAR(255),
        status_code INTEGER NOT NULL,
        success BOOLEAN NOT NULL,
        latency_ms INTEGER,
        request_body JSONB,
        response_body JSONB,
        error_message TEXT,
        signature_valid BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
    );
    await this.dataSource.query(
      `CREATE INDEX IF NOT EXISTS webhook_logs_tenant_bot_created
       ON webhook_logs(tenant_schema, bot_id, created_at DESC)`,
    );
  }

  private async writeWebhookLog(log: {
    tenantSchema: string;
    botId: string;
    externalUserId?: string;
    statusCode: number;
    success: boolean;
    latencyMs: number;
    requestBody?: any;
    responseBody?: any;
    errorMessage?: string;
    signatureValid: boolean;
  }) {
    await this.ensureWebhookLogsTable();
    await this.dataSource.query(
      `INSERT INTO webhook_logs
      (tenant_schema, bot_id, external_user_id, status_code, success, latency_ms, request_body, response_body, error_message, signature_valid)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        log.tenantSchema,
        log.botId,
        log.externalUserId || null,
        log.statusCode,
        log.success,
        log.latencyMs,
        log.requestBody ? JSON.stringify(log.requestBody) : null,
        log.responseBody ? JSON.stringify(log.responseBody) : null,
        log.errorMessage || null,
        log.signatureValid,
      ],
    );
  }

  private validateHmacSignature(args: {
    botId: string;
    externalUserId: string;
    message: string;
    secret: string;
    timestamp: string;
    signature: string;
  }): boolean {
    const now = Math.floor(Date.now() / 1000);
    const ts = Number(args.timestamp);

    if (!Number.isFinite(ts) || Math.abs(now - ts) > 300) {
      return false;
    }

    const payload = `${args.timestamp}.${args.botId}.${args.externalUserId}.${args.message}`;
    const expected = createHmac('sha256', args.secret).update(payload).digest('hex');

    const expectedBuffer = Buffer.from(expected, 'utf8');
    const providedBuffer = Buffer.from(args.signature, 'utf8');

    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, providedBuffer);
  }

  @Get()
  findAll(@Req() req: Request) {
    return this.botsService.findAll((req as any).tenantSchema);
  }

  @Post()
  create(@Req() req: Request, @Body() payload: any) {
    return this.botsService.create((req as any).tenantSchema, payload);
  }

  @Put(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() payload: any) {
    return this.botsService.update((req as any).tenantSchema, id, payload);
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.botsService.remove((req as any).tenantSchema, id);
  }

  @Post(':id/webhook')
  @UseGuards()
  @ApiOperation({ summary: 'Public webhook entry for API channel bot' })
  async apiWebhook(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() payload: any,
  ) {
    const startedAt = Date.now();
    const tenantSchema = (req as any).tenantSchema;
    const tenantSettings = (req as any).tenantSettings || {};
    const tenantId = (req as any).tenantId;

    if (!this.isValidSchemaName(tenantSchema)) {
      throw new UnauthorizedException('Invalid tenant schema');
    }

    if (!tenantId) {
      throw new UnauthorizedException('x-api-key is required');
    }

    const bots = await this.botsService.findAll(tenantSchema);
    const bot = bots.find((item) => item.id === id);

    if (!bot) {
      throw new NotFoundException('Bot not found');
    }

    const apiChannel = bot.channels?.find((channel: any) => channel.type === 'api');
    if (!apiChannel || !apiChannel.enabled) {
      throw new UnauthorizedException('API channel is disabled for this bot');
    }

    const expectedToken = bot.channelConfigs?.api?.bearerToken;
    const authHeader = (req.headers.authorization || '').toString();
    const providedToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!expectedToken || providedToken !== expectedToken) {
      throw new UnauthorizedException('Invalid bot bearer token');
    }

    const message = (payload?.message || payload?.text || '').toString().trim();
    if (!message || message.length === 0) {
      throw new BadRequestException('message is required');
    }

    const externalUserId =
      (payload?.user_id || payload?.userId || payload?.sender_id || payload?.from || 'anonymous')
        .toString();

    const hmacSecret = bot.channelConfigs?.api?.hmacSecret;
    const signatureHeader = (req.headers['x-signature'] || '').toString();
    const timestampHeader = (req.headers['x-timestamp'] || '').toString();

    if (!hmacSecret) {
      throw new ForbiddenException('API channel hmacSecret is not configured');
    }

    const signatureValid = this.validateHmacSignature({
      botId: id,
      externalUserId,
      message,
      secret: hmacSecret,
      timestamp: timestampHeader,
      signature: signatureHeader,
    });

    if (!signatureValid) {
      await this.writeWebhookLog({
        tenantSchema,
        botId: id,
        externalUserId,
        statusCode: 401,
        success: false,
        latencyMs: Date.now() - startedAt,
        requestBody: payload,
        errorMessage: 'Invalid webhook signature',
        signatureValid: false,
      });
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const conversationLookup = await this.dataSource.query(
      `SELECT id FROM ${tenantSchema}.conversations
       WHERE channel = 'api' AND channel_user_id = $1 AND (metadata->>'bot_id') = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [externalUserId, id],
    );

    const conversationId =
      conversationLookup?.[0]?.id ||
      (
        await this.dataSource.query(
          `INSERT INTO ${tenantSchema}.conversations (channel, channel_user_id, status, metadata)
           VALUES ('api', $1, 'active', $2)
           RETURNING id`,
          [externalUserId, JSON.stringify({ bot_id: id, webhook: true })],
        )
      )?.[0]?.id;

    await this.dataSource.query(
      `INSERT INTO ${tenantSchema}.messages (conversation_id, role, content, metadata)
       VALUES ($1, 'user', $2, $3)`,
      [conversationId, message, JSON.stringify({ bot_id: id, source: 'api_webhook' })],
    );

    const historyRows = await this.dataSource.query(
      `SELECT role, content FROM ${tenantSchema}.messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC
       LIMIT 20`,
      [conversationId],
    );

    const history = historyRows
      .map((row: any) => ({ role: row.role, content: row.content }))
      .filter((row: any) => ['user', 'assistant', 'system'].includes(row.role));

    try {
      const aiResponse = await this.aiService.chat(
        message,
        history,
        {
          ...tenantSettings,
          default_model: bot.model || tenantSettings?.default_model,
        },
        {
          model: bot.model || tenantSettings?.default_model,
        },
      );

      await this.dataSource.query(
        `INSERT INTO ${tenantSchema}.messages (conversation_id, role, content, metadata, tokens_used, model_used)
         VALUES ($1, 'assistant', $2, $3, $4, $5)`,
        [
          conversationId,
          aiResponse.content,
          JSON.stringify({ bot_id: id, source: 'api_webhook' }),
          aiResponse.tokens_used,
          aiResponse.model,
        ],
      );

      const result = {
        success: true,
        bot_id: id,
        conversation_id: conversationId,
        reply: aiResponse.content,
        model: aiResponse.model,
      };

      await this.writeWebhookLog({
        tenantSchema,
        botId: id,
        externalUserId,
        statusCode: 200,
        success: true,
        latencyMs: Date.now() - startedAt,
        requestBody: payload,
        responseBody: result,
        signatureValid: true,
      });

      return result;
    } catch (error: any) {
      await this.writeWebhookLog({
        tenantSchema,
        botId: id,
        externalUserId,
        statusCode: error?.status || 500,
        success: false,
        latencyMs: Date.now() - startedAt,
        requestBody: payload,
        errorMessage: error?.message || 'Webhook processing failed',
        signatureValid: true,
      });
      throw error;
    }
  }

  @Get(':id/webhook/logs')
  @ApiOperation({ summary: 'Get latest webhook logs for a bot' })
  async getWebhookLogs(@Req() req: Request, @Param('id') id: string) {
    const tenantSchema = (req as any).tenantSchema;
    if (!this.isValidSchemaName(tenantSchema)) {
      throw new UnauthorizedException('Invalid tenant schema');
    }

    await this.ensureWebhookLogsTable();
    return this.dataSource.query(
      `SELECT id, external_user_id, status_code, success, latency_ms, error_message, signature_valid, created_at
       FROM webhook_logs
       WHERE tenant_schema = $1 AND bot_id = $2
       ORDER BY created_at DESC
       LIMIT 100`,
      [tenantSchema, id],
    );
  }
}
