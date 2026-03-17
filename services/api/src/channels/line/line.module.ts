import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LineController } from './line.controller';
import { LineService } from './line.service';

@Module({
  imports: [HttpModule],
  controllers: [LineController],
  providers: [LineService],
  exports: [LineService],
})
export class LineModule {}
