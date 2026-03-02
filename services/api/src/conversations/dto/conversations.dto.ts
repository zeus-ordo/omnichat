import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsObject, IsNumber, Min, Max } from 'class-validator';

export class CreateConversationDto {
  @ApiPropertyOptional({ enum: ['web', 'line', 'facebook', 'api'] })
  @IsOptional()
  @IsEnum(['web', 'line', 'facebook', 'api'])
  channel?: string = 'web';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  channel_user_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class ConversationQueryDto {
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

  @ApiPropertyOptional({ enum: ['active', 'closed', 'archived'] })
  @IsOptional()
  @IsEnum(['active', 'closed', 'archived'])
  status?: string;

  @ApiPropertyOptional({ enum: ['web', 'line', 'facebook', 'api'] })
  @IsOptional()
  @IsEnum(['web', 'line', 'facebook', 'api'])
  channel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigned_agent_id?: string;
}

export class SendMessageDto {
  @ApiProperty()
  @IsString()
  content: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 2 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;
}
