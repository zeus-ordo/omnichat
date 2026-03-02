import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { MessageTemplatesController } from './message-templates.controller';
import { MessageTemplatesService } from './message-templates.service';

@Module({
  controllers: [UsersController, ApiKeysController, MessageTemplatesController],
  providers: [UsersService, ApiKeysService, MessageTemplatesService],
  exports: [UsersService, ApiKeysService, MessageTemplatesService],
})
export class UsersModule {}
