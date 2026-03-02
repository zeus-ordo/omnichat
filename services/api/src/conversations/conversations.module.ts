import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { MessagesModule } from '../messages/messages.module';
import { AiModule } from '../ai/ai.module';
import { SurveysModule } from '../surveys/surveys.module';

@Module({
  imports: [MessagesModule, AiModule, SurveysModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
