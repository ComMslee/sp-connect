import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TelecomAuthService } from './telecom-auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { KakaoStrategy } from './strategies/kakao.strategy';
import { NaverStrategy } from './strategies/naver.strategy';
import { User } from '../users/entities/user.entity';
import { Admin } from '../admin/entities/admin.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { UserSocialProvider } from './entities/user-social-provider.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Admin, RefreshToken, UserSocialProvider]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '1h') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TelecomAuthService, JwtStrategy, KakaoStrategy, NaverStrategy],
  exports: [AuthService],
})
export class AuthModule {}
