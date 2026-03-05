import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../../users/entities/user.entity';
import { Admin } from '../../admin/entities/admin.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Admin) private readonly adminRepo: Repository<Admin>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: {
    sub: string;
    phone?: string;
    email?: string;
    role?: string;
    isAdmin?: boolean;
  }): Promise<any> {
    // 관리자 토큰: admins 테이블에서 조회
    if (payload.isAdmin) {
      const admin = await this.adminRepo.findOne({
        where: { id: payload.sub, isActive: true },
      });
      if (!admin) {
        throw new UnauthorizedException('유효하지 않은 관리자 토큰입니다.');
      }
      return { ...admin, isAdmin: true };
    }

    // 회원 토큰: users 테이블에서 조회
    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }
    return user;
  }
}
