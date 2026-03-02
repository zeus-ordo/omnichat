import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Messages')
@Controller('messages')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('conversation/:conversationId')
  async getMessages(
    @Param('conversationId') conversationId: string,
    @Req() req: Request,
  ) {
    const tenantSchema = (req as any).tenantSchema;
    return this.messagesService.getConversationMessages(tenantSchema, conversationId);
  }
}
