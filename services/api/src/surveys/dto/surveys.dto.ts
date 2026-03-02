import { IsString, IsArray, IsBoolean, IsOptional, IsNotEmpty, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QuestionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  type: 'text' | 'rating' | 'choice' | 'textarea';

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  options?: string[];

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  required?: boolean;
}

export class CreateSurveyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ type: [QuestionDto] })
  @IsArray()
  @IsObject({ each: true })
  questions: QuestionDto[];

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  trigger_keywords?: string[];

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

export class UpdateSurveyDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ type: [QuestionDto] })
  @IsArray()
  @IsOptional()
  questions?: QuestionDto[];

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  trigger_keywords?: string[];

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

export class SubmitSurveyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  conversation_id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  survey_id: string;

  @ApiProperty()
  @IsObject()
  answers: Record<string, any>;
}
