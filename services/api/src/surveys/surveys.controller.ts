import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query,
  Req,
  UseGuards 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SurveysService } from './surveys.service';
import { CreateSurveyDto, UpdateSurveyDto, SubmitSurveyDto } from './dto/surveys.dto';
import { Request } from 'express';

@ApiTags('Surveys')
@Controller('surveys')
@ApiBearerAuth()
export class SurveysController {
  constructor(private readonly surveysService: SurveysService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new survey' })
  async create(
    @Body() createDto: CreateSurveyDto,
    @Req() req: Request,
  ) {
    const tenantSchema = (req as any).tenantSchema || 'tenant_demo';
    const userId = (req as any).user?.id;
    return this.surveysService.createSurvey(createDto, tenantSchema, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all surveys' })
  async findAll(@Req() req: Request) {
    const tenantSchema = (req as any).tenantSchema || 'tenant_demo';
    return this.surveysService.getSurveys(tenantSchema);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get survey by ID' })
  async findOne(@Param('id') id: string, @Req() req: Request) {
    const tenantSchema = (req as any).tenantSchema || 'tenant_demo';
    return this.surveysService.getSurvey(id, tenantSchema);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update survey' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateSurveyDto,
    @Req() req: Request,
  ) {
    const tenantSchema = (req as any).tenantSchema || 'tenant_demo';
    return this.surveysService.updateSurvey(id, updateDto, tenantSchema);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete survey' })
  async remove(@Param('id') id: string, @Req() req: Request) {
    const tenantSchema = (req as any).tenantSchema || 'tenant_demo';
    return this.surveysService.deleteSurvey(id, tenantSchema);
  }

  @Post('responses')
  @ApiOperation({ summary: 'Submit survey response' })
  async submitResponse(
    @Body() submitDto: SubmitSurveyDto,
    @Req() req: Request,
  ) {
    const tenantSchema = (req as any).tenantSchema || 'tenant_demo';
    return this.surveysService.submitSurveyResponse(submitDto, tenantSchema);
  }

  @Get(':id/responses')
  @ApiOperation({ summary: 'Get survey responses' })
  async getResponses(@Param('id') id: string, @Req() req: Request) {
    const tenantSchema = (req as any).tenantSchema || 'tenant_demo';
    return this.surveysService.getSurveyResponses(id, tenantSchema);
  }
}
