import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';

@Module({
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
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
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
