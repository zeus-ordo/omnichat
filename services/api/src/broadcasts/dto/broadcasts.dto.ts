import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsNumber, Min, Max } from 'class-validator';

export class CreateBroadcastDto {
  @ApiProperty()
  @IsString()
  subject: string;

  @ApiProperty()
  @IsString()
  content: string;

  @ApiPropertyOptional({ enum: ['all', 'web', 'line', 'facebook', 'api'] })
  @IsOptional()
  @IsEnum(['all', 'web', 'line', 'facebook', 'api'])
  channel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scheduled_at?: string;
}

export class BroadcastQueryDto {
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

  @ApiPropertyOptional({ enum: ['draft', 'scheduled', 'sent', 'cancelled'] })
  @IsOptional()
  @IsEnum(['draft', 'scheduled', 'sent', 'cancelled'])
  status?: string;
}
