import {
  Injectable, UnauthorizedException, ConflictException,
  BadRequestException, Logger, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User, AuthProvider, UserStatus } from '../users/entities/user.entity';
import { Admin } from '../admin/entities/admin.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { UserSocialProvider } from './entities/user-social-provider.entity';
import { RegisterDto, LoginDto } from './dto/auth.dto';

/** socialLogin() 결과 타입 */
export type SocialLoginResult =
  | { linked: true;  user: User; tokens: any }
  | { linked: false; socialTempToken: string; socialProfile: { provider: string; name?: string; email?: string } };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)               private readonly userRepo: Repository<User>,
    @InjectRepository(Admin)              private readonly adminRepo: Repository<Admin>,
    @InjectRepository(RefreshToken)       private readonly tokenRepo: Repository<RefreshToken>,
    @InjectRepository(UserSocialProvider) private readonly socialRepo: Repository<UserSocialProvider>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ============================================================
  // 회원 가입 (본인인증 CI 필수)
  // ============================================================
  async register(dto: RegisterDto): Promise<{ user: Partial<User>; tokens: any }> {
    // 이메일 중복 체크
    const existingEmail = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existingEmail) throw new ConflictException('이미 사용 중인 이메일입니다.');

    // 전화번호 중복 체크
    const existingPhone = await this.userRepo.findOne({ where: { phone: dto.phone } });
    if (existingPhone) throw new ConflictException('이미 가입된 휴대폰 번호입니다.');

    // 본인인증 CI 필수
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

    // 소셜 연동 — 소셜에서 가입 페이지로 왔을 때 socialToken이 존재
    if (dto.socialToken) {
      await this.linkSocialByToken(savedUser.id, dto.socialToken);
    }

    const tokens = await this.generateTokens(savedUser);
    const { passwordHash: _, ...safeUser } = savedUser as any;
    return { user: safeUser, tokens };
  }

  // ============================================================
  // 이메일 + 비밀번호 로그인
  // ============================================================
  async login(dto: LoginDto): Promise<{ user: Partial<User>; tokens: any }> {
    const user = await this.userRepo.findOne({
      where: { email: dto.email, status: UserStatus.ACTIVE },
      select: ['id', 'name', 'email', 'phone', 'passwordHash', 'status', 'pointBalance', 'authProvider', 'isVerified'],
    });

    if (!user) throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');

    const tokens = await this.generateTokens(user);
    const { passwordHash: _, ...safeUser } = user as any;
    return { user: safeUser, tokens };
  }

  // ============================================================
  // 소셜 로그인 (카카오/네이버 Passport 콜백 후 호출)
  // ============================================================
  async socialLogin(profile: {
    provider: string;
    providerId: string;
    name?: string;
    email?: string;
    phone?: string;
  }): Promise<SocialLoginResult> {
    // user_social_providers에서 연결 여부 조회
    const socialLink = await this.socialRepo.findOne({
      where: { provider: profile.provider, providerId: profile.providerId },
      relations: ['user'],
    });

    if (socialLink) {
      // Case A: 연결된 계정 있음 → 로그인 처리
      const user = socialLink.user;
      if (user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('계정이 비활성화 상태입니다. 관리자에게 문의하세요.');
      }
      const tokens = await this.generateTokens(user);
      return { linked: true, user, tokens };
    }

    // Case B: 연결된 계정 없음 → 10분 유효 임시 토큰 발급
    this.logger.log(`[Social] 미연결 계정: ${profile.provider}/${profile.providerId}`);
    const socialTempToken = this.jwtService.sign(
      {
        social: true,
        provider: profile.provider,
        providerId: profile.providerId,
        name: profile.name,
        email: profile.email,
      },
      { expiresIn: '10m' },
    );
    return {
      linked: false,
      socialTempToken,
      socialProfile: { provider: profile.provider, name: profile.name, email: profile.email },
    };
  }

  // ============================================================
  // 소셜 프로필 조회 (register 페이지 pre-fill용)
  // ============================================================
  async getSocialProfile(token: string): Promise<{ provider: string; name?: string; email?: string }> {
    try {
      const payload = this.jwtService.verify(token);
      if (!payload.social) throw new BadRequestException('유효하지 않은 토큰입니다.');
      return { provider: payload.provider, name: payload.name, email: payload.email };
    } catch {
      throw new BadRequestException('만료되었거나 유효하지 않은 소셜 토큰입니다.');
    }
  }

  // ============================================================
  // 소셜 연동 목록 조회
  // ============================================================
  async getMySocials(userId: string): Promise<{ provider: string; connectedAt: Date }[]> {
    const links = await this.socialRepo.find({ where: { userId } });
    return links.map(l => ({ provider: l.provider, connectedAt: l.connectedAt }));
  }

  // ============================================================
  // 소셜 연동 (로그인된 유저 + socialTempToken)
  // ============================================================
  async linkSocial(userId: string, socialToken: string): Promise<void> {
    await this.linkSocialByToken(userId, socialToken);
  }

  // ============================================================
  // 소셜 연동 해제
  // ============================================================
  async unlinkSocial(userId: string, provider: string): Promise<void> {
    const link = await this.socialRepo.findOne({ where: { userId, provider } });
    if (!link) throw new NotFoundException(`${provider} 연동 정보를 찾을 수 없습니다.`);
    await this.socialRepo.remove(link);
    this.logger.log(`[Social] 연동 해제: userId=${userId}, provider=${provider}`);
  }

  // ============================================================
  // 토큰 갱신
  // ============================================================
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

  // ============================================================
  // 관리자 로그인
  // ============================================================
  async adminLogin(email: string, password: string) {
    const admin = await this.adminRepo.findOne({
      where: { email, isActive: true },
      select: ['id', 'username', 'email', 'passwordHash', 'role', 'isActive'],
    });

    if (!admin) throw new UnauthorizedException('아이디 또는 비밀번호가 올바르지 않습니다.');
    const isValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isValid) throw new UnauthorizedException('아이디 또는 비밀번호가 올바르지 않습니다.');

    await this.adminRepo.update(admin.id, { lastLoginAt: new Date() });

    const payload = { sub: admin.id, email: admin.email, role: admin.role, isAdmin: true };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '8h' });

    return {
      admin: { id: admin.id, username: admin.username, email: admin.email, role: admin.role },
      tokens: { accessToken },
    };
  }

  // ============================================================
  // 로그아웃
  // ============================================================
  async logout(userId: string): Promise<void> {
    await this.tokenRepo.update({ userId, revoked: false }, { revoked: true });
  }

  // ============================================================
  // 현재 로그인 유저 정보 조회
  // ============================================================
  async getMe(userId: string): Promise<Partial<User>> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
    return user;
  }

  // ============================================================
  // 내부 유틸리티
  // ============================================================
  private async linkSocialByToken(userId: string, socialToken: string): Promise<void> {
    let payload: any;
    try {
      payload = this.jwtService.verify(socialToken);
    } catch {
      throw new BadRequestException('만료되었거나 유효하지 않은 소셜 토큰입니다.');
    }
    if (!payload.social) throw new BadRequestException('유효하지 않은 소셜 토큰입니다.');

    // 이미 다른 계정에 연결된 소셜인지 확인
    const existing = await this.socialRepo.findOne({
      where: { provider: payload.provider, providerId: payload.providerId },
    });
    if (existing && existing.userId !== userId) {
      throw new ConflictException('이미 다른 계정에 연결된 소셜 계정입니다.');
    }
    if (existing && existing.userId === userId) {
      // 이미 연결됨 — 중복 요청이므로 무시
      return;
    }

    await this.socialRepo.save(
      this.socialRepo.create({ userId, provider: payload.provider, providerId: payload.providerId }),
    );
    this.logger.log(`[Social] 연동 완료: userId=${userId}, provider=${payload.provider}`);
  }

  private async generateTokens(user: User) {
    // JWT 페이로드: email 기반으로 변경 (기존: phone)
    const payload = { sub: user.id, email: user.email };
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
