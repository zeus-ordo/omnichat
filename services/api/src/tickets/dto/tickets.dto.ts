import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsNumber, Min, Max } from 'class-validator';

export class CreateTicketDto {
  @ApiProperty()
  @IsString()
  subject: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ['high', 'medium', 'low'] })
  @IsOptional()
  @IsEnum(['high', 'medium', 'low'])
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  conversation_id?: string;
}

export class TicketQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: ['open', 'in_progress', 'resolved', 'closed'] })
  @IsOptional()
  @IsEnum(['open', 'in_progress', 'resolved', 'closed'])
  status?: string;

  @ApiPropertyOptional({ enum: ['high', 'medium', 'low'] })
  @IsOptional()
  @IsEnum(['high', 'medium', 'low'])
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigned_agent_id?: string;
}

export class UpdateTicketDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ['open', 'in_progress', 'resolved', 'closed'] })
  @IsOptional()
  @IsEnum(['open', 'in_progress', 'resolved', 'closed'])
  status?: string;

  @ApiPropertyOptional({ enum: ['high', 'medium', 'low'] })
  @IsOptional()
  @IsEnum(['high', 'medium', 'low'])
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigned_agent_id?: string;
}
