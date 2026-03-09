import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';

@Module({
  controllers: [TicketsController],
  providers: [TicketsService,
    {
      provide: DataSource,
      useFactory: () => new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USER || 'omnibot',
        password: process.env.DB_PASSWORD || 'omnibot_secure_pass',
        database: process.env.DB_NAME || 'omnibot',
      }),
    },
  ],
  exports: [TicketsService],
})
export class TicketsModule {}
