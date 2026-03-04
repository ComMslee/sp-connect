import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { PointsModule } from './points/points.module';
import { UsersModule } from './users/users.module';
import { AdminModule } from './admin/admin.module';
import { ExternalModule } from './external/external.module';
import { databaseConfig } from './config/database.config';

@Module({
  imports: [
    // 환경 변수
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),

    // DB 연결
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => databaseConfig(configService),
    }),

    // Rate Limiting (IP당 1분에 100회)
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    // 스케줄러 (포인트 만료 처리용)
    ScheduleModule.forRoot(),

    // 기능 모듈
    AuthModule,
    PointsModule,
    UsersModule,
    AdminModule,
    ExternalModule,
  ],
})
export class AppModule {}
