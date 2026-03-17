import { Module } from '@nestjs/common';
import { ChannelsService } from './channels.controller';
import { ChannelsController } from './channels.controller';
import { LineModule } from './line/line.module';
import { FacebookModule } from './facebook/facebook.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';

@Module({
  imports: [LineModule, FacebookModule, WhatsAppModule],
  controllers: [ChannelsController],
  providers: [ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
