import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { DocumentsModule } from './documents/documents.module';
import { ChannelsModule } from './channels/channels.module';
import { AiModule } from './ai/ai.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SurveysModule } from './surveys/surveys.module';
import { TicketsModule } from './tickets/tickets.module';
import { BroadcastsModule } from './broadcasts/broadcasts.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Rate Limiting 模組
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,   // 1 秒
        limit: 10,   // 每秒最多 10 個請求
      },
      {
        name: 'medium',
        ttl: 10000,  // 10 秒
        limit: 50,   // 每 10 秒最多 50 個請求
      },
      {
        name: 'long',
        ttl: 60000, // 1 分鐘
        limit: 200,  // 每分鐘最多 200 個請求
      },
    ]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get('DATABASE_URL');
        
        let host = configService.get('DB_HOST') || 'postgres';
        let port = parseInt(configService.get('DB_PORT') || '5432');
        let username = configService.get('DB_USER') || 'omnibot';
        let password = configService.get('DB_PASSWORD') || 'omnibot_secure_pass';
        let database = configService.get('DB_NAME') || 'omnibot';

        if (databaseUrl) {
          const url = new URL(databaseUrl);
          host = url.hostname;
          port = parseInt(url.port) || 5432;
          username = url.username;
          password = url.password;
          database = url.pathname.replace('/', '');
        }

        return {
          type: 'postgres',
          host,
          port,
          username,
          password,
          database,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: false,
          logging: configService.get('NODE_ENV') === 'development',
        };
      },
      inject: [ConfigService],
    }),
    AuthModule,
    TenantsModule,
    UsersModule,
    ConversationsModule,
    MessagesModule,
    DocumentsModule,
    ChannelsModule,
    AiModule,
    WebhooksModule,
    AnalyticsModule,
    SurveysModule,
    TicketsModule,
    BroadcastsModule,
  ],
})
export class AppModule {
  configure(consumer: any) {
    consumer
      .apply(TenantMiddleware)
      .exclude('/api/auth/(.*)', '/api/docs/(.*)', '/health', '/api/health')
      .forRoutes('*');
  }
}
