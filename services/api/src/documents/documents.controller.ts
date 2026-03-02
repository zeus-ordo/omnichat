import { Controller, Get, Post, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Documents')
@Controller('documents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  findAll(@Req() req: Request) {
    const tenantSchema = (req as any).tenantSchema;
    return this.documentsService.findAll(tenantSchema);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request) {
    const tenantSchema = (req as any).tenantSchema;
    return this.documentsService.findOne(tenantSchema, id);
  }

  @Post()
  create(@Body() data: { name: string; type: string; file_url?: string }, @Req() req: Request) {
    const tenantSchema = (req as any).tenantSchema;
    return this.documentsService.create(tenantSchema, data);
  }
}
