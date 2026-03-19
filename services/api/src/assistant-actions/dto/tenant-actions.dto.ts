import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

const CHANNEL_TYPES = ['line', 'facebook', 'whatsapp'] as const;

export class TenantActionContextDto {
  @ApiPropertyOptional({
    description: 'Optional business reason for audit and future approval workflows',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class PlanTenantBotChannelToggleDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  botId: string;

  @ApiProperty({ enum: CHANNEL_TYPES })
  @IsIn(CHANNEL_TYPES)
  channelType: (typeof CHANNEL_TYPES)[number];

  @ApiProperty()
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({ type: TenantActionContextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TenantActionContextDto)
  context?: TenantActionContextDto;
}

export class PlanTenantBotChannelConfigUpdateDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  botId: string;

  @ApiProperty({ enum: CHANNEL_TYPES })
  @IsIn(CHANNEL_TYPES)
  channelType: (typeof CHANNEL_TYPES)[number];

  @ApiProperty({
    description: 'Channel config patch with allowlisted keys per channel type',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  config: Record<string, unknown>;

  @ApiPropertyOptional({ type: TenantActionContextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TenantActionContextDto)
  context?: TenantActionContextDto;
}

export class PlanTenantAssistantConfigUpdateDto {
  @ApiPropertyOptional({ maxLength: 4000 })
  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(4000)
  prompt?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  welcomeMessage?: string;

  @ApiPropertyOptional({ maxLength: 1200 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(1200)
  scopeNotes?: string;

  @ApiPropertyOptional({ type: TenantActionContextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TenantActionContextDto)
  context?: TenantActionContextDto;
}

export class PlanTenantKbBindingUpdateDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  botId: string;

  @ApiProperty({ description: 'Knowledge base identifier already provisioned for tenant', maxLength: 128 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  knowledgeBaseId: string;

  @ApiPropertyOptional({ type: TenantActionContextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TenantActionContextDto)
  context?: TenantActionContextDto;
}

export class ConfirmTenantActionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  actionId: string;

  @ApiProperty({
    description: 'One-time confirmation code returned by plan endpoint',
    minLength: 8,
    maxLength: 8,
    example: 'A1B2C3D4',
  })
  @IsString()
  @Length(8, 8)
  @Matches(/^[A-Z0-9]{8}$/)
  confirmationCode: string;

  @ApiProperty({
    description: 'Explicit phrase to avoid accidental execution from free-form chat',
    example: 'CONFIRM_TENANT_ACTION',
  })
  @IsString()
  @Matches(/^CONFIRM_TENANT_ACTION$/)
  confirmationPhrase: string;
}
