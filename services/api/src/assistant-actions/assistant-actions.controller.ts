import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AssistantActionsService } from './assistant-actions.service';
import { AuthUser } from './assistant-actions.types';
import {
  ConfirmTenantActionDto,
  PlanTenantAssistantConfigUpdateDto,
  PlanTenantBotChannelConfigUpdateDto,
  PlanTenantBotChannelToggleDto,
  PlanTenantKbBindingUpdateDto,
} from './dto/tenant-actions.dto';

interface PlanActionPayload {
  message: string;
}

interface ConfirmActionPayload {
  confirmationToken?: string;
}

interface RequestWithAssistantContext extends Request {
  tenantSchema?: string;
  user?: AuthUser;
}

@ApiTags('Assistant Actions')
@Controller('ai/assistant/actions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AssistantActionsController {
  constructor(private readonly assistantActionsService: AssistantActionsService) {}

  private getContext(req: RequestWithAssistantContext) {
    const tenantSchema = req.tenantSchema;
    const user = req.user;

    if (!tenantSchema) {
      throw new BadRequestException('tenantSchema is missing');
    }

    if (!user || !user.sub) {
      throw new BadRequestException('user context is missing');
    }

    return {
      tenantSchema,
      user,
    };
  }

  @Post('plan')
  @ApiOperation({ summary: 'Plan or execute assistant action from chat message' })
  async plan(@Body() body: PlanActionPayload, @Req() req: RequestWithAssistantContext) {
    const message = (body?.message || '').trim();
    if (!message) {
      throw new BadRequestException('message is required');
    }

    return this.assistantActionsService.planAction(message, this.getContext(req));
  }

  @Post('confirm/:actionId')
  @ApiOperation({ summary: 'Confirm and execute a pending assistant action' })
  async confirm(
    @Param('actionId') actionId: string,
    @Body() body: ConfirmActionPayload,
    @Req() req: RequestWithAssistantContext,
  ) {
    if (!actionId) {
      throw new BadRequestException('actionId is required');
    }

    return this.assistantActionsService.confirmAction(actionId, {
      ...this.getContext(req),
      confirmationToken: body?.confirmationToken,
    });
  }

  @Post('tenant/bot-channel/toggle/plan')
  @ApiOperation({ summary: 'Plan tenant bot channel toggle (owner/admin only, confirmation required)' })
  async planTenantBotChannelToggle(
    @Body() body: PlanTenantBotChannelToggleDto,
    @Req() req: RequestWithAssistantContext,
  ) {
    return this.assistantActionsService.planTenantBotChannelToggle(body, this.getContext(req));
  }

  @Post('tenant/bot-channel/config/plan')
  @ApiOperation({ summary: 'Plan tenant bot channel config update (owner/admin only, confirmation required)' })
  async planTenantBotChannelConfigUpdate(
    @Body() body: PlanTenantBotChannelConfigUpdateDto,
    @Req() req: RequestWithAssistantContext,
  ) {
    return this.assistantActionsService.planTenantBotChannelConfigUpdate(body, this.getContext(req));
  }

  @Post('tenant/assistant-config/plan')
  @ApiOperation({ summary: 'Plan assistant config update (owner/admin only, confirmation required)' })
  async planTenantAssistantConfigUpdate(
    @Body() body: PlanTenantAssistantConfigUpdateDto,
    @Req() req: RequestWithAssistantContext,
  ) {
    return this.assistantActionsService.planTenantAssistantConfigUpdate(body, this.getContext(req));
  }

  @Post('tenant/kb-binding/plan')
  @ApiOperation({ summary: 'Plan knowledge base binding update (owner/admin only, confirmation required)' })
  async planTenantKbBindingUpdate(
    @Body() body: PlanTenantKbBindingUpdateDto,
    @Req() req: RequestWithAssistantContext,
  ) {
    return this.assistantActionsService.planTenantKbBindingUpdate(body, this.getContext(req));
  }

  @Post('tenant/confirm')
  @ApiOperation({ summary: 'Confirm and execute a pending tenant-level assistant action with strict confirmation payload' })
  async confirmTenantAction(
    @Body() body: ConfirmTenantActionDto,
    @Req() req: RequestWithAssistantContext,
  ) {
    return this.assistantActionsService.confirmTenantAction(body, this.getContext(req));
  }

  @Get('history')
  @ApiOperation({ summary: 'Get current user assistant action history' })
  async history(@Req() req: RequestWithAssistantContext) {
    const context = this.getContext(req);
    return this.assistantActionsService.getHistory(context.tenantSchema, context.user);
  }
}
