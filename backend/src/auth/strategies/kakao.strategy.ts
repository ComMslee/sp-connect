import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-kakao';
import { ConfigService } from '@nestjs/config';
import { AuthProvider } from '../../users/entities/user.entity';

@Injectable()
export class KakaoStrategy extends PassportStrategy(Strategy, 'kakao') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get<string>('KAKAO_CLIENT_ID'),
      callbackURL: configService.get<string>('KAKAO_CALLBACK_URL', '/api/v1/auth/kakao/callback'),
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any) {
    return {
      provider: AuthProvider.KAKAO,
      providerId: String(profile.id),
      name: profile.displayName || profile.username,
      email: profile._json?.kakao_account?.email,
      phone: undefined,
    };
  }
}
