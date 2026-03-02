import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { SurveysModule } from '../surveys/surveys.module';

@Module({
  imports: [
    HttpModule.register({
      baseURL: process.env.AI_ENGINE_URL || 'http://ai-engine:8000',
      timeout: 120000,
    }),
    ConfigModule,
    SurveysModule,
  ],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
