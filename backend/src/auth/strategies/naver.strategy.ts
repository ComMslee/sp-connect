import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-naver-v2';
import { ConfigService } from '@nestjs/config';
import { AuthProvider } from '../../users/entities/user.entity';

@Injectable()
export class NaverStrategy extends PassportStrategy(Strategy, 'naver') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get<string>('NAVER_CLIENT_ID'),
      clientSecret: configService.get<string>('NAVER_CLIENT_SECRET'),
      callbackURL: configService.get<string>('NAVER_CALLBACK_URL', '/api/v1/auth/naver/callback'),
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any) {
    return {
      provider: AuthProvider.NAVER,
      providerId: profile.id,
      name: profile.name || profile.displayName,
      email: profile.email,
      phone: profile.mobile?.replace(/-/g, ''),
    };
  }
}
