import { Module } from '@nestjs/common';
import { ChannelsService } from './channels.controller';
import { ChannelsController } from './channels.controller';

@Module({
  controllers: [ChannelsController],
  providers: [ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
