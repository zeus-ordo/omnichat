import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { MessageTemplatesService } from './message-templates.service';

interface RequestWithTenant extends Request {
  tenantSchema: string;
}

@Controller('message-templates')
export class MessageTemplatesController {
  constructor(private templatesService: MessageTemplatesService) {}

  @Get()
  findAll(@Req() req: RequestWithTenant) {
    return this.templatesService.findAll(req.tenantSchema);
  }

  @Get('trigger')
  findByKeyword(@Query('keyword') keyword: string, @Req() req: RequestWithTenant) {
    return this.templatesService.findByKeyword(req.tenantSchema, keyword);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.templatesService.findOne(req.tenantSchema, id);
  }

  @Post()
  create(@Body() data: { 
    name: string; 
    content: string; 
    type?: string; 
    trigger_keyword?: string;
  }, @Req() req: RequestWithTenant) {
    return this.templatesService.create(req.tenantSchema, data);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: { 
    name?: string; 
    content?: string; 
    type?: string; 
    trigger_keyword?: string;
    is_active?: boolean;
  }, @Req() req: RequestWithTenant) {
    return this.templatesService.update(req.tenantSchema, id, data);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.templatesService.delete(req.tenantSchema, id);
  }
}
