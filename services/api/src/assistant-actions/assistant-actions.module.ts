import { Module } from '@nestjs/common';
import { AssistantActionsController } from './assistant-actions.controller';
import { AssistantActionsService } from './assistant-actions.service';

@Module({
  controllers: [AssistantActionsController],
  providers: [AssistantActionsService],
  exports: [AssistantActionsService],
})
export class AssistantActionsModule {}
