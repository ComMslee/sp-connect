import {
  Injectable, UnauthorizedException, ConflictException,
  BadRequestException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User, AuthProvider, UserStatus } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { RegisterDto, LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(RefreshToken) private readonly tokenRepo: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 일반 회원 가입 (본인인증 CI 필수)
   */
  async register(dto: RegisterDto): Promise<{ user: Partial<User>; tokens: any }> {
    const existingPhone = await this.userRepo.findOne({ where: { phone: dto.phone } });
    if (existingPhone) throw new ConflictException('이미 가입된 휴대폰 번호입니다.');

    if (dto.email) {
      const existingEmail = await this.userRepo.findOne({ where: { email: dto.email } });
      if (existingEmail) throw new ConflictException('이미 사용 중인 이메일입니다.');
    }

    // 본인인증 CI 검증 (실제 통신사 연동 시 TelecomAuthService 호출)
    if (!dto.ci) throw new BadRequestException('본인인증이 필요합니다.');

    const existingCi = await this.userRepo.findOne({ where: { ci: dto.ci } });
    if (existingCi) throw new ConflictException('이미 가입된 사용자입니다.');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = this.userRepo.create({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      ci: dto.ci,
      di: dto.di,
      isVerified: true,
      authProvider: AuthProvider.LOCAL,
      pointBalance: 0,
    });
    const savedUser = await this.userRepo.save(user);

    const tokens = await this.generateTokens(savedUser);
    const { passwordHash: _, ...safeUser } = savedUser as any;
    return { user: safeUser, tokens };
  }

  /**
   * 로그인
   */
  async login(dto: LoginDto): Promise<{ user: Partial<User>; tokens: any }> {
    const user = await this.userRepo.findOne({
      where: { phone: dto.phone, status: UserStatus.ACTIVE },
      select: ['id', 'name', 'phone', 'email', 'passwordHash', 'status', 'pointBalance'],
    });

    if (!user) throw new UnauthorizedException('아이디 또는 비밀번호가 올바르지 않습니다.');
    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) throw new UnauthorizedException('아이디 또는 비밀번호가 올바르지 않습니다.');

    const tokens = await this.generateTokens(user);
    const { passwordHash: _, ...safeUser } = user as any;
    return { user: safeUser, tokens };
  }

  /**
   * 소셜 로그인 (카카오/네이버 - Passport 콜백 후 호출)
   */
  async socialLogin(profile: {
    provider: AuthProvider;
    providerId: string;
    name: string;
    email?: string;
    phone?: string;
  }): Promise<{ user: User; tokens: any; isNew: boolean }> {
    let user = await this.userRepo.findOne({
      where: { authProvider: profile.provider, providerId: profile.providerId },
    });

    let isNew = false;
    if (!user) {
      user = this.userRepo.create({
        name: profile.name,
        email: profile.email,
        phone: profile.phone || '',
        authProvider: profile.provider,
        providerId: profile.providerId,
        isVerified: !!profile.phone,
        pointBalance: 0,
      });
      user = await this.userRepo.save(user);
      isNew = true;
    }

    const tokens = await this.generateTokens(user);
    return { user, tokens, isNew };
  }

  /**
   * 토큰 갱신
   */
  async refreshTokens(refreshToken: string): Promise<any> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.tokenRepo.findOne({
      where: { tokenHash, revoked: false },
      relations: ['user'],
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('유효하지 않은 리프레시 토큰입니다.');
    }

    await this.tokenRepo.update(stored.id, { revoked: true });
    return this.generateTokens(stored.user);
  }

  /**
   * 로그아웃
   */
  async logout(userId: string): Promise<void> {
    await this.tokenRepo.update({ userId, revoked: false }, { revoked: true });
  }

  private async generateTokens(user: User) {
    const payload = { sub: user.id, phone: user.phone };
    const accessToken = this.jwtService.sign(payload);

    const rawRefreshToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.tokenRepo.save(
      this.tokenRepo.create({ userId: user.id, tokenHash, expiresAt }),
    );

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: this.configService.get('JWT_EXPIRES_IN', '1h'),
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
