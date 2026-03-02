import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import {
  CreateConversationDto,
  ConversationQueryDto,
  SendMessageDto,
} from './dto/conversations.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Conversations')
@Controller('conversations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create new conversation' })
  async create(
    @Body() createDto: CreateConversationDto,
    @Req() req: Request,
  ) {
    const tenantSchema = (req as any).tenantSchema;
    const tenantSettings = (req as any).tenantSettings;
    return this.conversationsService.createConversation(
      createDto,
      tenantSchema,
      tenantSettings,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List conversations' })
  async findAll(
    @Query() query: ConversationQueryDto,
    @Req() req: Request,
  ) {
    const tenantSchema = (req as any).tenantSchema;
    return this.conversationsService.getConversations(query, tenantSchema);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get conversation by ID' })
  async findOne(@Param('id') id: string, @Req() req: Request) {
    const tenantSchema = (req as any).tenantSchema;
    return this.conversationsService.getConversation(id, tenantSchema);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send message to conversation' })
  async sendMessage(
    @Param('id') id: string,
    @Body() sendDto: SendMessageDto,
    @Req() req: Request,
  ) {
    const tenantSchema = (req as any).tenantSchema;
    const tenantSettings = (req as any).tenantSettings;
    return this.conversationsService.sendMessage(
      id,
      sendDto,
      tenantSchema,
      tenantSettings,
    );
  }

  @Post(':id/close')
  @ApiOperation({ summary: 'Close conversation' })
  async close(@Param('id') id: string, @Req() req: Request) {
    const tenantSchema = (req as any).tenantSchema;
    return this.conversationsService.closeConversation(id, tenantSchema);
  }

  @Put(':id/assign/:agentId')
  @ApiOperation({ summary: 'Assign agent to conversation' })
  async assign(
    @Param('id') id: string,
    @Param('agentId') agentId: string,
    @Req() req: Request,
  ) {
    const tenantSchema = (req as any).tenantSchema;
    return this.conversationsService.assignAgent(id, agentId, tenantSchema);
  }
}
