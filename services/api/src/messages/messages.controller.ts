import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Messages')
@Controller('messages')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('conversation/:conversationId')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin', 'agent', 'viewer')
  async getMessages(
    @Param('conversationId') conversationId: string,
    @Req() req: Request,
  ) {
    const tenantSchema = (req as any).tenantSchema;
    return this.messagesService.getConversationMessages(tenantSchema, conversationId);
  }
}
